/*  Cloudflare Worker — Claude proxy for Aria's Journal (Phase 4 live activation).
    Same pattern as the Summer Tracker's book-lookup Worker: the Anthropic API
    key lives HERE as a secret and never ships to the browser (spec §9).

    DEPLOY (one time):
      1. dash.cloudflare.com → Workers & Pages → Create → Worker. Name: journal-claude.
      2. Paste this file as the Worker code and Deploy.
      3. Settings → Variables:
           SECRET  ANTHROPIC_API_KEY = <your key>
           VAR     MODEL_ID          = claude-sonnet-5   (optional override; do not hardcode elsewhere)
      4. Copy the Worker URL and paste it in the journal's Parent Dashboard →
         Settings → "AI mode: live" + Worker URL. Done — the app swaps the mock
         for live behind the same validated interface.

    Server-side guarantees (spec §4.5/§9): JSON-only prompting, low max_tokens,
    corrections capped at 5, no rewriting of her text, calm safety flagging. */

const ALLOWED_ORIGINS = ['https://cksainia.github.io', 'http://localhost:5173']
const DEFAULT_MODEL = 'claude-sonnet-5'

const COACH_SYSTEM =
  'You are a warm, encouraging writing coach for Aria, a 9-year-old going into 3rd grade. ' +
  'She is the WRITER of every entry (people she mentions are family or friends). ' +
  'Be gentle, specific, and celebratory. Never be discouraging; never use words like ' +
  '"bad", "wrong", "weak", or "failed" in child-facing text. Never rewrite her writing for her. ' +
  'Return ONLY valid JSON matching the requested schema — no prose, no markdown fences.'

const ACTIONS = {
  reviewEntry: {
    maxTokens: 1500,
    user: (p) =>
      `Review this ${p.mode} journal entry by a grade-${p.gradeLevel} writer. ` +
      `Limit to the most important 3-5 corrections — don't overwhelm. ` +
      `If the text suggests immediate harm, self-harm, abuse, or danger, add a short calm note to safetyFlags ` +
      `(the child never sees it); otherwise safetyFlags must be []. ` +
      `Sparkle words offered: ${JSON.stringify(p.sparkleWordsOffered ?? [])}. ` +
      `parent_metrics: NJSLA grade-3 4-point estimates (null if under ~25 words).\n` +
      `Schema: {"schemaVersion":"1.0","encouragement":str,"strengths":[str],"nextStep":{"label":str,"reason":str,"example":str}|null,` +
      `"corrections":[{"id":str,"type":"spelling|grammar|punctuation|capitalization|word_choice|structure","category":str,"original":str,"suggestion":str,"explanationKid":str,"standardsTags":[str],"confidence":num}],` +
      `"counts":{"words":int,"sentences":int,"spelling":int,"grammar":int},` +
      `"rubric":{"ideas":1-3,"organization":1-3,"details":1-3,"voice":1-3,"conventions":1-3},` +
      `"sparkle_words_used":[str],"voiceNotes":[str],` +
      `"parent_metrics":{"njsla_written_expression_estimate":1-4,"njsla_conventions_estimate":1-4,"rubric_justification":str}|null,` +
      `"safetyFlags":[str]}\n\nENTRY:\n${String(p.plainText).slice(0, 4000)}`,
    post: (data) => {
      if (Array.isArray(data.corrections)) data.corrections = data.corrections.slice(0, 5)
      return data
    },
  },
  generateGuidedPrompt: {
    maxTokens: 600,
    user: (p) =>
      `Create ONE personalized grade-3 writing prompt from this check-in: ${JSON.stringify(p.checkin)}. ` +
      `Recently used genres (avoid repeating): ${JSON.stringify(p.recentGenres)}. ` +
      `Current book: ${p.currentBook || 'unknown'}. ` +
      `If mood includes sad/grumpy/nervous, keep the prompt gentle and optional-feeling — NEVER probe why. ` +
      `Rotate NJSLS-ELA grade-3 genres: narrative W.NW.3.3 (Story Builder), opinion W.AW.3.1 (Opinion Helper), informative W.IW.3.2 (Fact Teacher). ` +
      `sparkleWords: exactly 3 Lexile 700-800 words relevant to the prompt.\n` +
      `Schema: {"prompt":str,"genre":"narrative|opinion|informative","kidFriendlyName":str,"standardsTags":[str],"sparkleWords":[str,str,str],"planningChips":[3-6 str]}`,
  },
  generateWeeklyInsights: {
    maxTokens: 1200,
    user: (p) =>
      `Weekly writing insights for the PARENT of a 9-year-old, from these review summaries: ${JSON.stringify(p.reviews).slice(0, 6000)}. ` +
      `Week start: ${p.weekStart}. Use confidence language scaled to sample size. ` +
      `growthAreas recommendations must be actionable in IXL ELA grade 3. ` +
      `voice.evidenceQuotes: at most 2 short quotes from: ${JSON.stringify(p.excerpts).slice(0, 1500)}. ` +
      `kidVoiceCard is FOR THE CHILD: strengths/voice only, never weaknesses.\n` +
      `Schema: {"schemaVersion":"1.0","dateRange":{"start":str,"end":str},"sampleCounts":{"entries":int,"reviewedEntries":int},` +
      `"strengths":[str],"growthAreas":[{"pattern":str,"recommendation":str}],"voice":{"adjectives":[str],"evidenceQuotes":[str]},` +
      `"standardsCoverage":{str:int},"recommendedPractice":[str],"kidVoiceCard":str}`,
    post: (data) => {
      if (data?.voice?.evidenceQuotes) data.voice.evidenceQuotes = data.voice.evidenceQuotes.slice(0, 2)
      return data
    },
  },
  followUpQuestion: {
    maxTokens: 100,
    user: (p) =>
      `The child wrote: "${String(p.plainText).slice(0, 1000)}". Return ONE short encouraging follow-up ` +
      `question to keep her going (not a new assignment). Schema: {"question":str}`,
  },
  // PARENT-ONLY import path: OCR a photographed page of Aria's PAPER journal
  // into structured data the app can file under the right day. Vision request —
  // the payload carries the page image as base64.
  importJournalPage: {
    maxTokens: 1600,
    content: (p) => [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: p.mediaType || 'image/jpeg',
          data: String(p.imageBase64 || ''),
        },
      },
      {
        type: 'text',
        text:
          `This is a photo of one page from Aria's PAPER journal, being imported into her digital journal. ` +
          `Read her handwriting carefully (the photo may be rotated — read it in whatever orientation the text runs). ` +
          `Transcribe her writing VERBATIM — keep her exact words, spelling, and punctuation; never correct or embellish. ` +
          `Ignore the notebook's printed decorations, printed quotes, and page numbers — extract only what SHE wrote or chose.\n` +
          `- date: full date if she wrote one (YYYY-MM-DD), else null. dayOfWeek: if she wrote one (e.g. "Friday"), else null.\n` +
          `- moods: feelings she circled/marked/wrote, mapped onto: happy, excited, calm, proud, tired, sad, grumpy, nervous. ` +
          `Unmappable feelings (e.g. "awesome") go in extraFeelings verbatim.\n` +
          `- dayRating: overall day rating if clearly indicated, mapped onto: awesome, good, okay, meh, tough — else null.\n` +
          `- entries: one item per prompt/section she answered, title = the printed prompt she was answering ` +
          `(e.g. "Three good things today…"), text = her verbatim answer(s), joined with newlines for lists. ` +
          `Skip prompts she left blank.\n` +
          `- pageKind: "writing", "drawing" (mostly a picture), or "mixed". drawingDescription: if there is a drawing, ` +
          `one short factual sentence about it (include any labels she wrote), else null.\n` +
          `Schema: {"date":str|null,"dayOfWeek":str|null,"moods":[str],"extraFeelings":[str],"dayRating":str|null,` +
          `"entries":[{"title":str,"text":str}],"pageKind":"writing|drawing|mixed","drawingDescription":str|null}`,
      },
    ],
  },
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors)

    let body = {}
    try { body = await request.json() } catch { /* fall through */ }
    const action = ACTIONS[body.action]
    if (!action) return json({ error: 'unknown action' }, 400, cors)

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: env.MODEL_ID || DEFAULT_MODEL,
          max_tokens: action.maxTokens,
          system: COACH_SYSTEM,
          messages: [
            {
              role: 'user',
              // text-only actions build a string; vision actions build content blocks
              content: (action.content ?? action.user)(body.payload ?? {}),
            },
          ],
        }),
      })
      if (!r.ok) return json({ error: `anthropic ${r.status}` }, 502, cors)
      const msg = await r.json()
      const text = (msg.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}')
      if (jsonStart < 0 || jsonEnd < 0) return json({ error: 'no JSON in response' }, 502, cors)
      let data = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
      if (action.post) data = action.post(data)
      return json(data, 200, cors)
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, cors)
    }
  },
}

const json = (obj, status, cors) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
