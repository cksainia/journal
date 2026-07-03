import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { ReviewPanel, SelfChecklist } from '@/components/ReviewPanel'
import { saveSectionText, type JournalSection } from '@/lib/journal'
import { countWords, countSentences } from '@/lib/counting'
import { ActiveWpmTracker } from '@/lib/wpm'
import { speak, stopSpeaking } from '@/lib/speech'
import { celebrate } from '@/lib/confetti'
import { addWordsToShelf } from '@/lib/meta'
import { getClaudeService, isAiAvailable } from '@/services/claude'
import { reviewsUsedToday } from '@/lib/reviews'
import { useSettings } from '@/stores/settings'
import { cn } from '@/lib/utils'

const AUTOSAVE_MS = 3000

/** Genre-aware transition helper chips (spec §4.4). */
const TRANSITIONS: Record<string, string[]> = {
  narrative: ['First,', 'Next,', 'Then,', 'Suddenly,', 'Finally,'],
  opinion: ['I think', 'Because', 'For example,', 'Also,', 'In conclusion,'],
  informative: ['First,', 'Second,', 'Also,', 'For example,', 'Finally,'],
  default: ['First,', 'Next,', 'Because', 'For example,', 'Finally,'],
}

/** Replace the first occurrence of `needle` in the doc's text. Word-like
 *  needles match on word boundaries so correcting "i" never hits "trip". */
function replaceInEditor(editor: Editor, needle: string, replacement: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = /^[\w'’]+$/.test(needle) ? `\\b${esc}\\b` : esc
  let done = false
  editor.state.doc.descendants((node, pos) => {
    if (done || !node.isText || !node.text) return !done
    const m = node.text.match(new RegExp(pattern)) ?? node.text.match(new RegExp(pattern, 'i'))
    if (m && m.index !== undefined) {
      const from = pos + m.index
      editor
        .chain()
        .focus()
        .insertContentAt({ from, to: from + m[0].length }, replacement)
        .run()
      done = true
    }
    return !done
  })
  return done
}

/**
 * The writing studio (spec §4.4–4.5): TipTap editor with autosave (3s + blur),
 * sparkle-word live detection, planning/transition/dialogue helpers, word
 * collector, Read It Aloud, and the gated "Check My Writing" review step.
 * Active WPM is tracked silently and never rendered.
 */
export function SectionEditor({
  dateKey,
  section,
  onClose,
}: {
  dateKey: string
  section: JournalSection
  onClose: () => void
}) {
  const { settings } = useSettings()
  const [counts, setCounts] = useState({ words: 0, sentences: 0 })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [moreDetail, setMoreDetail] = useState(false)
  const [helpersOpen, setHelpersOpen] = useState(false)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [reviewsUsed, setReviewsUsed] = useState<number>(0)
  const [litSparkles, setLitSparkles] = useState<string[]>([])
  const [followUp, setFollowUp] = useState<string | null>(null)
  const [followUpBusy, setFollowUpBusy] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [collectWord, setCollectWord] = useState('')
  const [collecting, setCollecting] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saving = useRef(Promise.resolve())
  const wpm = useRef(new ActiveWpmTracker())

  const offered = useMemo(() => section.sparkleWords?.offered ?? [], [section.sparkleWords])
  const isGuided = section.type === 'guided'
  const isNudge = section.type === 'nudge'

  const editor = useEditor({
    extensions: [StarterKit],
    content: section.text || '',
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'tiptap', spellcheck: 'false', 'aria-label': 'Your journal entry' },
    },
    onUpdate({ editor }) {
      wpm.current.keystroke()
      const plain = editor.getText()
      setCounts({ words: countWords(plain), sentences: countSentences(plain) })
      if (offered.length) {
        const lower = plain.toLowerCase()
        setLitSparkles((prev) => {
          const lit = offered.filter((w) => lower.includes(w.toLowerCase()))
          if (lit.length > prev.length) {
            celebrate({ small: true }) // a sparkle word just lit up!
            void addWordsToShelf(lit.filter((w) => !prev.includes(w)))
          }
          return lit
        })
      }
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void persist('draft'), AUTOSAVE_MS)
    },
    onBlur() {
      clearTimeout(timer.current)
      void persist('draft')
    },
  })

  async function persist(status: 'draft' | 'saved' | 'archived') {
    if (!editor) return
    const html = editor.getHTML()
    const plain = editor.getText()
    setSaveState('saving')
    saving.current = saving.current
      .then(() =>
        saveSectionText(dateKey, section.id, html, plain, status, {
          activeWPM: wpm.current.wpm(countWords(plain)),
          sparkleUsed: litSparkles,
        }),
      )
      .then(() => setSaveState('saved'))
      .catch((e) => {
        console.warn('autosave failed (will retry on next change):', e.message)
        setSaveState('idle')
      })
    await saving.current
  }

  useEffect(() => {
    if (!editor) return
    const plain = editor.getText()
    setCounts({ words: countWords(plain), sentences: countSentences(plain) })
    if (offered.length) {
      const lower = plain.toLowerCase()
      setLitSparkles(offered.filter((w) => lower.includes(w.toLowerCase())))
    }
    return () => {
      clearTimeout(timer.current)
      stopSpeaking()
    }
  }, [editor, offered])

  useEffect(() => {
    reviewsUsedToday(dateKey).then(setReviewsUsed).catch(() => {})
  }, [dateKey, reviewing])

  async function done() {
    clearTimeout(timer.current)
    stopSpeaking()
    // Leaving an empty section behind just clutters the journal — archive it
    // silently instead (recoverable by the parent, invisible everywhere else).
    const empty = !editor || !editor.getText().trim()
    await persist(empty ? 'archived' : 'saved')
    if (!empty && counts.words > 0) celebrate({ small: counts.sentences < 3 }) // save moment (spec §4.6)
    onClose()
  }

  function listen() {
    if (!editor) return
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const ok = speak(editor.getText(), () => setSpeaking(false))
    setSpeaking(ok)
  }

  function insertChip(text: string) {
    editor?.chain().focus().insertContent(text + ' ').run()
  }

  async function askFollowUp() {
    if (!editor) return
    setFollowUpBusy(true)
    try {
      setFollowUp(await getClaudeService().followUpQuestion(editor.getText()))
    } catch {
      setFollowUp('And then what happened?')
    } finally {
      setFollowUpBusy(false)
    }
  }

  async function collect() {
    if (!collectWord.trim()) return
    await addWordsToShelf([collectWord])
    setCollectWord('')
    setCollecting(false)
    celebrate({ small: true })
  }

  const aiOk = isAiAvailable()
  const reviewsLeft = Math.max(0, settings.reviewsPerDay - reviewsUsed)
  const canReview = aiOk && counts.words >= 10 && reviewsLeft > 0 && !reviewing
  const transitions = TRANSITIONS[section.genre] ?? TRANSITIONS.default
  const showTarget =
    isGuided && !settings.noStreakPressure && counts.sentences < settings.sentenceGoal

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={done}>
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-bold" aria-live="polite">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={listen}
            aria-label={speaking ? 'Stop reading aloud' : 'Listen to my story'}
            disabled={counts.words === 0}
          >
            {speaking ? '⏹ Stop' : '🔊 Listen'}
          </Button>
        </div>
      </div>

      {section.prompt && (
        <div className="bg-lavender-soft border border-lavender/30 rounded-2xl px-4 py-3">
          <p className="font-extrabold text-ink">
            <span aria-hidden>💭 </span>
            {section.prompt}
          </p>
          {isNudge && <p className="text-muted text-sm mt-1">One sentence is enough 💛</p>}
          {followUp && <p className="text-sm font-bold text-lavender mt-2">🦉 {followUp}</p>}
        </div>
      )}

      {/* Sparkle Words — light up live as she types them (spec §4.2A) */}
      {offered.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Sparkle words">
          {offered.map((w) => {
            const lit = litSparkles.includes(w)
            return (
              <span
                key={w}
                aria-label={w + (lit ? ' — used!' : ' — not used yet')}
                className={cn(
                  'rounded-full px-4 py-2 font-extrabold border transition-all',
                  lit
                    ? 'bg-sunny text-ink border-sunny shadow-card scale-105'
                    : 'bg-sunny-soft border-sunny/40 text-muted',
                )}
              >
                {lit ? '✨ ' : ''}
                {w}
              </span>
            )
          })}
        </div>
      )}

      <div className="kid-editor paper-page paper-ink p-5 pl-14">
        <EditorContent editor={editor} />
      </div>

      {/* Writing helpers (spec §4.3–4.4): planning, transitions, dialogue, word collector */}
      <div>
        <Chip onClick={() => setHelpersOpen(!helpersOpen)} aria-expanded={helpersOpen}>
          🧰 Helpers {helpersOpen ? '▾' : '▸'}
        </Chip>
        {helpersOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {section.planningChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-extrabold text-muted self-center">Plan:</span>
                {section.planningChips.map((c) => (
                  <Chip key={c} onClick={() => insertChip(c)}>
                    {c}
                  </Chip>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-extrabold text-muted self-center">Connect:</span>
              {transitions.map((t) => (
                <Chip key={t} onClick={() => insertChip(t)}>
                  {t}
                </Chip>
              ))}
              <Chip onClick={() => insertChip('“” said')} aria-label="Dialogue helper — insert quotation marks">
                💬 “…” said
              </Chip>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {collecting ? (
                <>
                  <input
                    autoFocus
                    value={collectWord}
                    onChange={(e) => setCollectWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void collect()}
                    placeholder="A cool word…"
                    aria-label="Word to collect"
                    className="min-h-11 px-4 rounded-full border-2 border-line focus:border-teal focus:outline-none text-sm font-bold w-40"
                  />
                  <Chip onClick={() => void collect()}>⭐ Keep it!</Chip>
                </>
              ) : (
                <Chip onClick={() => setCollecting(true)}>⭐ Collect a word</Chip>
              )}
              <span className="text-xs text-muted font-bold">
                🧵 Stretch tip: pick a sentence — can you add where, when, how, or why?
              </span>
            </div>
          </div>
        )}
      </div>

      {isNudge && counts.sentences > 0 && (
        <div className="flex items-center gap-2 px-1">
          {moreDetail ? (
            <p className="text-sm font-bold text-teal">Ooh yes — what else do you remember? 🕵️</p>
          ) : (
            <Chip onClick={() => setMoreDetail(true)}>➕ Add one more detail?</Chip>
          )}
        </div>
      )}

      {showTarget && (
        <p className="text-center text-sm text-muted font-bold">
          Can you get to {settings.sentenceGoal} sentences? 🎯 ({counts.sentences} so far)
        </p>
      )}

      <div className="flex items-center justify-between px-2 flex-wrap gap-2">
        <p className="text-sm text-muted font-bold">
          {counts.sentences} {counts.sentences === 1 ? 'sentence' : 'sentences'} · {counts.words}{' '}
          {counts.words === 1 ? 'word' : 'words'}
        </p>
        <div className="flex gap-2">
          {isGuided && counts.sentences > 0 && !followUp && (
            <Button variant="ghost" size="sm" onClick={askFollowUp} disabled={followUpBusy || !aiOk}>
              {followUpBusy ? '…' : 'Keep going? 🦉'}
            </Button>
          )}
          <Button
            size="md"
            variant="secondary"
            onClick={async () => {
              clearTimeout(timer.current)
              await persist('draft')
              setReviewing(true)
            }}
            disabled={!canReview}
            title={
              !aiOk
                ? 'The writing checker needs the internet'
                : reviewsLeft <= 0
                  ? 'All checks used for today'
                  : counts.words < 10
                    ? 'Write a little more first'
                    : 'Check my writing'
            }
          >
            ✅ Check my writing
          </Button>
          <Button size="md" variant="soft" onClick={done}>
            Done 💾
          </Button>
        </div>
      </div>

      {!aiOk && (
        <p className="text-center text-xs text-muted font-bold">
          The writing checker needs the internet — use your own check below! 💪
        </p>
      )}

      {reviewing && editor ? (
        <ReviewPanel
          dateKey={dateKey}
          section={section}
          getPlainText={() => editor.getText()}
          applyCorrection={(orig, repl) => replaceInEditor(editor, orig, repl)}
          onClose={() => setReviewing(false)}
        />
      ) : (
        <div>
          <Chip onClick={() => setChecklistOpen(!checklistOpen)} aria-expanded={checklistOpen}>
            ✅ My own check {checklistOpen ? '▾' : '▸'}
          </Chip>
          {checklistOpen && (
            <div className="mt-2">
              <SelfChecklist />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
