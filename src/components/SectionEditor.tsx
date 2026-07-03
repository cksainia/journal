import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '@/components/ui/button'
import { saveSectionText, type JournalSection } from '@/lib/journal'
import { countWords, countSentences } from '@/lib/counting'

const AUTOSAVE_MS = 3000

/**
 * Minimal TipTap editor (spec §2 mandates TipTap — no plain textarea).
 * Autosave: debounced 3s while typing + immediately on blur; "Done" marks the
 * section saved. Native spellcheck squiggles are off — review is its own step.
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
  const [counts, setCounts] = useState({ words: 0, sentences: 0 })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saving = useRef(Promise.resolve())

  const editor = useEditor({
    extensions: [StarterKit],
    content: section.text || '',
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'tiptap', spellcheck: 'false', 'aria-label': 'Your journal entry' },
    },
    onUpdate({ editor }) {
      const plain = editor.getText()
      setCounts({ words: countWords(plain), sentences: countSentences(plain) })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void persist('draft'), AUTOSAVE_MS)
    },
    onBlur() {
      clearTimeout(timer.current)
      void persist('draft')
    },
  })

  // Serialize writes so a blur-save and timer-save never race each other.
  async function persist(status: 'draft' | 'saved') {
    if (!editor) return
    const html = editor.getHTML()
    const plain = editor.getText()
    setSaveState('saving')
    saving.current = saving.current
      .then(() => saveSectionText(dateKey, section.id, html, plain, status))
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
    return () => clearTimeout(timer.current)
  }, [editor])

  async function done() {
    clearTimeout(timer.current)
    await persist('saved')
    onClose()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={done}>
          ← Back
        </Button>
        <span className="text-xs text-muted font-bold" aria-live="polite">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : ''}
        </span>
      </div>

      <div className="kid-editor bg-paper border border-line rounded-3xl p-5 shadow-card">
        <EditorContent editor={editor} />
      </div>

      {/* Calm counters (spec §4.4) — informative, never pressuring */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-muted font-bold">
          {counts.sentences} {counts.sentences === 1 ? 'sentence' : 'sentences'} · {counts.words}{' '}
          {counts.words === 1 ? 'word' : 'words'}
        </p>
        <Button size="md" variant="soft" onClick={done}>
          Done for now 💾
        </Button>
      </div>
    </div>
  )
}
