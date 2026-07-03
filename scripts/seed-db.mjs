/**
 * seed-db (spec §13 Phase 2): 14 days of realistic fake entries — varying
 * lengths, moods, modes, multi-section days, one archived section, reviews
 * with rubric/NJSLA/WPM data — so dashboards and Phase 3 tracker sync are
 * testable immediately.
 *
 * EMULATOR-ONLY: writes via the emulator's `Bearer owner` bypass, which does
 * not exist in production. Run with emulators up:  npm run seed:db
 */
const FIRESTORE = 'http://127.0.0.1:8080'
const PROJECT = 'demo-aria-journal'
const FAMILY_ID = 'aria'
const CHILD_UID = 'O93lhqGLBye4TLzYrREpRaEBm972'
const TZ = 'America/New_York'

const ymd = (d) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

// ── Firestore REST value encoding ──────────────────────────────────────────
const val = (v) => {
  if (v === null) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } }
  return { mapValue: { fields: fields(v) } }
}
const fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)]))

async function put(path, data) {
  const res = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: fields(data) }),
    },
  )
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`)
}

// ── Sample content ──────────────────────────────────────────────────────────
const SAMPLES = [
  { mode: 'nudge',  moods: ['happy'],             rating: 'good',    loc: 'home',           acts: ['read', 'played-outside'], text: 'I am grateful for my dog because he always waits for me at the door.' },
  { mode: 'free',   moods: ['excited', 'proud'],  rating: 'awesome', loc: 'school-camp',    acts: ['sports', 'family-time'],  text: 'Today at camp we had a water balloon war. My team won because we made a fort out of the picnic tables! Then we got freeze pops. The blue ones are the best even though they turn your tongue blue. I want to do it again tomorrow.' },
  { mode: 'nudge',  moods: ['calm'],              rating: 'okay',    loc: 'home',           acts: ['art', 'screen-time'],     text: 'The book I am reading is Amulet. Emily just found the secret door and I could NOT stop reading.' },
  { mode: 'free',   moods: ['tired'],             rating: 'meh',     loc: 'home',           acts: ['screen-time'],            text: 'today was boring. we didnt go anywhere. I played minecraft and built a castle with a moat' },
  { mode: 'free',   moods: ['excited'],           rating: 'awesome', loc: 'traveling',      acts: ['family-time', 'learned'], text: 'We drove to the shore house today! I saw three dolphins from the boardwalk. Dad said they follow the fishing boats. The waves were huge and I jumped over seventeen of them. My cousin buried my legs in the sand and we made a mermaid tail.' },
  { mode: 'nudge',  moods: ['happy', 'calm'],     rating: 'good',    loc: 'friends-family', acts: ['played-outside', 'cooked'], text: 'Something kind I did today was help grandma make roti. She said I rolled them almost round!' },
  { mode: 'free',   moods: ['grumpy'],            rating: 'tough',   loc: 'home',           acts: [],                          text: 'My brother took my markers without asking and the orange one is dried out now.' },
  { mode: 'nudge',  moods: ['proud', 'excited'],  rating: 'awesome', loc: 'home',           acts: ['learned', 'read'],        text: 'I am really good at math puzzles. I got all the Kangaroo practice ones right and even the hard star problem. I got good by doing one every morning with my cereal.' },
  { mode: 'free',   moods: ['happy'],             rating: 'good',    loc: 'somewhere-new',  acts: ['learned', 'family-time'], text: 'We went to a trampoline park I never went to before. There was a foam pit and a ninja course. I fell in the foam pit five times but on the last try I made it across the rings!' },
  { mode: 'nudge',  moods: ['calm', 'happy'],     rating: 'good',    loc: 'home',           acts: ['read', 'art'],            text: 'If I could jump into any book I would jump into Aru Shah and borrow the golden lightning bolt. First I would fly over my school.' },
  { mode: 'free',   moods: ['nervous', 'excited'], rating: 'good',   loc: 'school-camp',    acts: ['sports'],                 text: 'Tomorrow is the swim test at camp. I can do the whole front crawl but I am nervous about the deep end part. My counselor said she will be right there. I practiced my breathing in the bathtub.' },
  { mode: 'nudge',  moods: ['happy'],             rating: 'okay',    loc: 'home',           acts: ['cooked', 'family-time'],  text: 'A joke I made up: Why did the cookie go to the doctor? Because it was feeling crummy!' },
  { mode: 'free',   moods: ['sad', 'calm'],       rating: 'meh',     loc: 'home',           acts: ['read'],                   text: 'My friend Maya moved away today. We traded friendship bracelets and she gave me half of her best heart. Mom says we can video call on saturdays. I hope her new house has a good climbing tree like ours.' },
  { mode: 'nudge',  moods: ['excited'],           rating: 'awesome', loc: 'home',           acts: ['played-outside', 'learned'], text: 'What made me go WOW was the firefly that landed right on my finger and blinked THREE times before it flew away.' },
]

const NUDGE_PROMPTS = {
  0: 'What are you grateful for today?',
  2: 'Tell me about the book you are reading!',
  5: "What's something kind you did (or saw someone do) today?",
  7: 'What are you really good at? How did you get good at it?',
  9: 'If you could jump into any book, which one — and what happens?',
  11: 'Tell me a joke you heard — or make one up!',
  13: 'What made you go "WOW" recently?',
}

const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)
const countSentences = (t) => t.split(/[.!?…]+/).map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s)).length

// ── Seed 14 days ending yesterday (today stays clean for live testing) ─────
const now = new Date()
let daysWritten = 0

for (let i = 14; i >= 1; i--) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
  const dateKey = ymd(d)
  const idx = 14 - i
  const s = SAMPLES[idx % SAMPLES.length]
  const dayId = `${FAMILY_ID}_${CHILD_UID}_${dateKey.replaceAll('-', '')}`
  const created = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 30)

  const sections = [
    {
      id: 's1',
      type: s.mode,
      title: s.mode === 'nudge' ? "Today's Nudge" : '',
      prompt: NUDGE_PROMPTS[idx] ?? '',
      text: `<p>${s.text}</p>`,
      plainText: s.text,
      status: 'saved',
    },
  ]
  // Day 5: multi-section day (nudge + free) — exercises multi-section totals/sync.
  if (idx === 4) {
    sections.push({
      id: 's2', type: 'nudge', title: "Today's Nudge",
      prompt: 'Describe your day in exactly 3 words. Then explain them!',
      text: '<p>Salty. Sandy. Happy. Because the beach makes everything taste like salt and feel like sand and me feel happy.</p>',
      plainText: 'Salty. Sandy. Happy. Because the beach makes everything taste like salt and feel like sand and me feel happy.',
      status: 'saved',
    })
  }
  // Day 8: an ARCHIVED section that must NOT count in totals or sync.
  if (idx === 7) {
    sections.push({
      id: 's2', type: 'free', title: '', prompt: '',
      text: '<p>asdf I dont want this one</p>', plainText: 'asdf I dont want this one',
      status: 'archived',
    })
  }

  const live = sections.filter((x) => x.status !== 'archived')
  const totals = {
    words: live.reduce((n, x) => n + countWords(x.plainText), 0),
    sentences: live.reduce((n, x) => n + countSentences(x.plainText), 0),
    sections: live.length,
    reviewedSections: idx % 3 === 0 ? 1 : 0,
    drawings: 0,
  }

  await put(`journalDays/${dayId}`, {
    familyId: FAMILY_ID,
    childId: CHILD_UID,
    dateKey,
    timezone: TZ,
    checkin: {
      moods: s.moods,
      location: s.loc,
      activities: s.acts,
      somethingElse: '',
      dayRating: s.rating,
      bonus: { question: 'Did anything surprise you today?', answer: idx % 2 ? 'yes' : 'no' },
    },
    dailyTotals: totals,
    streakCredit: true,
    createdAt: created,
    updatedAt: created,
  })

  for (const sec of sections) {
    await put(`journalDays/${dayId}/sections/${sec.id}`, {
      type: sec.type,
      title: sec.title,
      prompt: sec.prompt,
      text: sec.text,
      plainText: sec.plainText,
      wordCount: countWords(sec.plainText),
      sentenceCount: countSentences(sec.plainText),
      activeWPM: sec.status === 'archived' ? null : 9 + ((idx * 7) % 9), // 9–17 WPM, varied
      status: sec.status,
      clientId: 'seed-script',
      createdAt: created,
      updatedAt: created,
    })
    // Every 3rd day: a review with rubric + NJSLA estimates (mock-shaped, spec §4.5).
    if (idx % 3 === 0 && sec.id === 's1') {
      const words = countWords(sec.plainText)
      await put(`journalDays/${dayId}/sections/${sec.id}/reviews/r1`, {
        schemaVersion: '1.0',
        reviewType: 'initial',
        model: 'mock',
        counts: { words, sentences: countSentences(sec.plainText), spelling: idx % 4 === 0 ? 2 : 1, grammar: 1 },
        rubric: { ideas: 2 + (idx % 2), organization: 2, details: 1 + (idx % 3 ? 1 : 0), voice: 3, conventions: 2 },
        strengths: ['Strong personal voice with specific details.'],
        nextStep: { label: 'Add one more detail', reason: 'It helps your reader picture the moment.' },
        corrections: [],
        voiceNotes: ['funny', 'curious'],
        sparkleWordsUsed: [],
        grammarByCategory: { capitalization: 1, punctuation: idx % 4 === 0 ? 1 : 0 },
        parentMetrics: words >= 25
          ? { njslaWrittenExpression: 2 + (idx % 2), njslaConventions: 2, rubricJustification: 'Seed data — varied sentences, light transitions.' }
          : null,
        postFixRecheck: null,
        safetyFlags: [],
        createdAt: created,
      })
    }
  }
  daysWritten++
}

console.log(`Seeded ${daysWritten} days ending ${ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))} (today left clean).`)
