'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import { Plugin } from '@tiptap/pm/state'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import { marked } from 'marked'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Table2,
} from 'lucide-react'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'

function prepareContent(content: string): string {
  if (content.trim().startsWith('<')) return content
  const md = content
    // Convert markdown tables to HTML before passing to marked
    .replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (match, header, rows) => {
      const ths = header.split('|').filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join('')
      const trs = rows.trim().split('\n').map((row: string) => {
        const tds = row.split('|').filter(Boolean).map((c: string) => `<td>${c.trim()}</td>`).join('')
        return `<tr>${tds}</tr>`
      }).join('')
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
    })
  return marked.parse(md) as string
}

// Pressing Enter at the end of a heading exits to a new paragraph instead of
// creating another heading (the ProseMirror default split behaviour).
const HeadingEnterExit = Extension.create({
  name: 'headingEnterExit',
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive('heading')) return false
        const { $from } = editor.state.selection
        // Only intercept when cursor is at the very end; middle splits stay as headings.
        if ($from.parentOffset < $from.parent.content.size) return false
        return editor.chain().splitBlock().setParagraph().run()
      },
    }
  },
})

// When pasting plain text that contains markdown headers (# / ## / ###),
// convert to HTML via marked so headings render correctly.
const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData('text/plain')
            if (!text || !text.match(/^#{1,6} /m)) return false
            const html = marked.parse(text) as string
            const dom = document.createElement('div')
            dom.innerHTML = html
            const parser = PMDOMParser.fromSchema(view.state.schema)
            const slice = parser.parseSlice(dom, { preserveWhitespace: false })
            view.dispatch(view.state.tr.replaceSelection(slice))
            return true
          },
        },
      }),
    ]
  },
})

interface ArticleEditorProps {
  articleId: string
  initialContent: string
  getTextRef: React.MutableRefObject<(() => string) | null>
  getWordCountRef?: React.MutableRefObject<(() => number) | null>
  replaceContentRef?: React.MutableRefObject<((markdown: string) => void) | null>  // full replace (auto mode)
  applyContentRef?: React.MutableRefObject<((markdown: string) => void) | null>   // insert at cursor (review mode)
  applyAtRangeRef?: React.MutableRefObject<((from: number, to: number, html: string) => void) | null>
  onSelectionChange?: (text: string, from: number, to: number) => void
}

export default function ArticleEditor({ articleId, initialContent, getTextRef, getWordCountRef, replaceContentRef, applyContentRef, applyAtRangeRef, onSelectionChange }: ArticleEditorProps) {
  const supabase = createClient()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const onSelectionChangeRef = useRef(onSelectionChange)
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange }, [onSelectionChange])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const editor = useEditor({
    extensions: [StarterKit, Typography, CharacterCount, HeadingEnterExit, MarkdownPaste, Table.configure({ resizable: false }), TableRow, TableCell, TableHeader],
    content: prepareContent(initialContent),
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (isMountedRef.current) setSaveStatus('idle')
      saveTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return
        setSaveStatus('saving')
        const html = editor.getHTML()
        const wordCount = editor.storage.characterCount?.words?.() ?? null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('articles').update({ content: html, word_count: wordCount }).eq('id', articleId)
        if (!isMountedRef.current) return
        if (error) {
          console.error('[autosave] Failed to save article:', error)
          setSaveStatus('error')
          setTimeout(() => { if (isMountedRef.current) setSaveStatus('idle') }, 3000)
          return
        }
        setSaveStatus('saved')
        setTimeout(() => { if (isMountedRef.current) setSaveStatus('idle') }, 2000)
      }, 1500)
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, '\n')
        onSelectionChangeRef.current?.(text, from, to)
      } else {
        onSelectionChangeRef.current?.('', from, to)
      }
    },
    editorProps: {
      attributes: {
        class: 'prose-editor-content outline-none',
      },
    },
  })

  useEffect(() => {
    if (editor) {
      getTextRef.current = () => editor.getText()
      if (getWordCountRef) {
        getWordCountRef.current = () => editor.storage.characterCount?.words?.() ?? 0
      }
      if (replaceContentRef) {
        // Full article replacement — used by auto mode
        replaceContentRef.current = (markdown: string) => {
          const html = marked.parse(markdown) as string
          editor.commands.setContent(html)
        }
      }
      if (applyContentRef) {
        // Insert at cursor — used by review mode suggestions
        applyContentRef.current = (markdown: string) => {
          const html = marked.parse(markdown) as string
          editor.chain().focus().insertContent(html).run()
        }
      }
      if (applyAtRangeRef) {
        applyAtRangeRef.current = (from: number, to: number, html: string) => {
          editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, html).run()
        }
      }
    }
    return () => {
      getTextRef.current = null
      if (getWordCountRef) getWordCountRef.current = null
      if (replaceContentRef) replaceContentRef.current = null
      if (applyContentRef) applyContentRef.current = null
      if (applyAtRangeRef) applyAtRangeRef.current = null
    }
  }, [editor, getTextRef, getWordCountRef, replaceContentRef, applyContentRef, applyAtRangeRef])


  if (!editor) return null

  const wordCount: number = (editor.storage.characterCount as { words: () => number })?.words() ?? 0

  return (
    <>
    <style>{`
      .ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; }
      .ProseMirror th, .ProseMirror td { border: 1px solid rgba(184,115,51,0.3); padding: 6px 10px; text-align: left; }
      .ProseMirror th { background: rgba(184,115,51,0.1); font-weight: 600; }
    `}</style>
    <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-[rgba(184,115,51,0.15)] flex-wrap">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
          <ListOrdered className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote className="w-4 h-4" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={editor.isActive('table')} title="Insert table">
          <Table2 className="w-4 h-4" />
        </ToolbarBtn>
        <div className="flex-1" />
        {saveStatus === 'saving' && <span className="text-xs text-[var(--cream-faint)]">Saving…</span>}
        {saveStatus === 'saved' && <span className="text-xs text-green-600">Saved</span>}
        {saveStatus === 'error' && <span className="text-xs text-red-500">Save failed</span>}
      </div>

      {/* Editor body */}
      <EditorContent editor={editor} className="px-5 py-4 min-h-96 max-h-[70vh] overflow-y-auto" />

      {/* Footer: word count */}
      <div className="px-5 py-2 border-t border-[rgba(184,115,51,0.15)] text-xs text-[var(--cream-faint)]">
        {wordCount.toLocaleString()} words · ~{Math.ceil(wordCount / 200)} min read
      </div>
    </div>
    </>
  )
}

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-[var(--ink-deep)] text-[var(--cream)]' : 'text-[var(--cream-dim)] hover:bg-[var(--ink-deep)] hover:text-[var(--cream-dim)]'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-4 bg-[var(--ink-deep)] mx-1 shrink-0" />
}
