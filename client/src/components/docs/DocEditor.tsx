// ─────────────────────────────────────────────────────────────────
// DocEditor — Tiptap-based block editor for Replaiy Docs.
//
// Wraps EditorContent with:
//   • StarterKit (paragraph, headings 1–3, lists, blockquote, code, hr)
//   • TaskList + TaskItem (round checkbox todos)
//   • Placeholder ("Start writing…")
//   • SlashMenu (typing "/" at line/word start opens block-picker)
//   • AI selection popover (✨ floating button → glass menu)
//
// All editor styling lives in index.css under .rp-prose.
// ─────────────────────────────────────────────────────────────────
import {
  useEditor,
  EditorContent,
  type Editor,
  type JSONContent,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Minus,
  Image as ImageIcon,
  Sparkles,
  PenLine,
  FileText as FileTextIcon,
  Wand2,
  CheckCircle2,
  Globe,
  Scissors,
  Maximize2,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';

// ───────────────────────── Slash menu items ─────────────────────────
type BlockKind =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'ordered'
  | 'todo'
  | 'quote'
  | 'code'
  | 'divider'
  | 'image';

interface SlashItem {
  key: BlockKind;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const SLASH_ITEMS: SlashItem[] = [
  { key: 'text', label: 'Text', hint: 'Plain paragraph', icon: Type },
  { key: 'h1', label: 'Heading 1', hint: 'Large section heading', icon: Heading1 },
  { key: 'h2', label: 'Heading 2', hint: 'Medium section heading', icon: Heading2 },
  { key: 'h3', label: 'Heading 3', hint: 'Small section heading', icon: Heading3 },
  { key: 'bullet', label: 'Bullet list', hint: 'Simple unordered list', icon: List },
  { key: 'ordered', label: 'Numbered list', hint: 'Ordered 1, 2, 3', icon: ListOrdered },
  { key: 'todo', label: 'Todo list', hint: 'Checkbox tasks', icon: ListChecks },
  { key: 'quote', label: 'Quote', hint: 'Indented quote block', icon: Quote },
  { key: 'code', label: 'Code', hint: 'Monospaced block', icon: Code2 },
  { key: 'divider', label: 'Divider', hint: 'Thin horizontal line', icon: Minus },
  { key: 'image', label: 'Image', hint: 'Insert a placeholder', icon: ImageIcon },
];

// Mock AI responses for the selection popover (UI-only for v14)
const AI_MOCK_RESPONSES: Record<string, string> = {
  continue:
    'In short, the strongest signal we have is that customers will pay for the version of the product that respects their time. Every feature we add either earns or spends that respect.',
  summarize:
    'Three priorities for the quarter: retention, pricing, and one enterprise pilot. Each has a clear owner and a measurable outcome.',
  improve:
    'We have three priorities for the quarter. Each has a clear owner, a measurable outcome, and a weekly review cadence with the team.',
  fix:
    'We have three priorities for the quarter. Each has a clear owner and a measurable outcome.',
  shorter: 'Three priorities for the quarter, each with a clear owner.',
  longer:
    'We have three priorities for the quarter, and each one has been carefully scoped so that a single person owns the outcome end to end. The owners report progress weekly, the team reviews the numbers together, and we adjust the plan as the data comes in. Nothing on this list is here by accident — each item earned its place by surviving three rounds of trimming.',
  'translate-en':
    'We have three priorities for the quarter. Each has a clear owner and a measurable outcome.',
  'translate-nl':
    'We hebben drie prioriteiten voor het kwartaal. Elke prioriteit heeft een duidelijke eigenaar en een meetbaar resultaat.',
  'translate-es':
    'Tenemos tres prioridades para el trimestre. Cada una tiene un responsable claro y un resultado medible.',
  'translate-fr':
    'Nous avons trois priorités pour le trimestre. Chacune a un responsable clair et un résultat mesurable.',
  'translate-de':
    'Wir haben drei Prioritäten für das Quartal. Jede hat einen klaren Verantwortlichen und ein messbares Ergebnis.',
};

// ───────────────────────── DocEditor component ─────────────────────────
export interface DocEditorProps {
  initialContent: JSONContent;
  onChange?: (json: JSONContent) => void;
  /** Optional ref to expose the Tiptap editor instance to the parent. */
  editorRef?: (editor: Editor | null) => void;
}

export function DocEditor({ initialContent, onChange, editorRef }: DocEditorProps) {
  // Slash menu state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashCoords, setSlashCoords] = useState<{ x: number; y: number } | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null);

  // AI popover state
  const [aiButtonCoords, setAiButtonCoords] = useState<{ x: number; y: number } | null>(null);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [aiPopoverCoords, setAiPopoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [aiSubmenu, setAiSubmenu] = useState<'root' | 'translate'>('root');
  const [aiThinking, setAiThinking] = useState(false);
  const selectionRangeRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'rp-codeblock' } },
        blockquote: { HTMLAttributes: { class: 'rp-quote' } },
        horizontalRule: { HTMLAttributes: { class: 'rp-hr' } },
      }),
      TaskList.configure({ HTMLAttributes: { class: 'rp-tasklist' } }),
      TaskItem.configure({
        HTMLAttributes: { class: 'rp-taskitem' },
        nested: true,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading';
          return "Type '/' for commands, or just start writing…";
        },
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'rp-prose focus:outline-none',
        'data-testid': 'doc-editor-content',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
      handleSlashTrigger(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      handleSelectionAi(editor);
      handleSlashTrigger(editor);
    },
  });

  // Expose editor instance upward (for title bar etc)
  useEffect(() => {
    editorRef?.(editor ?? null);
    return () => editorRef?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ─────────────────────── Slash menu detection ───────────────────────
  const handleSlashTrigger = useCallback((ed: Editor) => {
    const { from } = ed.state.selection;
    const $from = ed.state.selection.$from;
    // Look at the text before the cursor on the current line.
    const start = $from.start();
    const textBefore = ed.state.doc.textBetween(start, from, '\n', '\n');
    // Match "/" at the start of the line OR after whitespace.
    const m = textBefore.match(/(^|\s)\/([\w]*)$/);
    if (!m) {
      if (slashOpen) {
        setSlashOpen(false);
        slashRangeRef.current = null;
      }
      return;
    }
    const q = m[2] ?? '';
    const slashStart = from - q.length - 1;
    slashRangeRef.current = { from: slashStart, to: from };
    setSlashQuery(q);
    setSlashIndex(0);

    // Position the menu near the cursor.
    try {
      const coords = ed.view.coordsAtPos(slashStart);
      setSlashCoords({ x: coords.left, y: coords.bottom + 6 });
    } catch {
      setSlashCoords({ x: 0, y: 0 });
    }
    setSlashOpen(true);
  }, [slashOpen]);

  const filteredSlash = useMemo(() => {
    const q = slashQuery.trim().toLowerCase();
    if (!q) return SLASH_ITEMS;
    return SLASH_ITEMS.filter(
      (it) => it.label.toLowerCase().includes(q) || it.key.includes(q)
    );
  }, [slashQuery]);

  const insertBlock = useCallback(
    (kind: BlockKind) => {
      if (!editor) return;
      const range = slashRangeRef.current;
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      switch (kind) {
        case 'text':
          chain.setParagraph().run();
          break;
        case 'h1':
          chain.toggleHeading({ level: 1 }).run();
          break;
        case 'h2':
          chain.toggleHeading({ level: 2 }).run();
          break;
        case 'h3':
          chain.toggleHeading({ level: 3 }).run();
          break;
        case 'bullet':
          chain.toggleBulletList().run();
          break;
        case 'ordered':
          chain.toggleOrderedList().run();
          break;
        case 'todo':
          chain.toggleTaskList().run();
          break;
        case 'quote':
          chain.toggleBlockquote().run();
          break;
        case 'code':
          chain.toggleCodeBlock().run();
          break;
        case 'divider':
          chain.setHorizontalRule().run();
          break;
        case 'image':
          // Glass placeholder block — insert a paragraph with a hint we style.
          chain
            .insertContent({
              type: 'paragraph',
              content: [{ type: 'text', text: '🖼  Image placeholder · drop a file here' }],
            })
            .run();
          break;
      }
      setSlashOpen(false);
      slashRangeRef.current = null;
    },
    [editor]
  );

  // Keyboard nav for slash menu
  useEffect(() => {
    if (!slashOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => Math.min(filteredSlash.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const it = filteredSlash[slashIndex];
        if (it) insertBlock(it.key);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSlashOpen(false);
        slashRangeRef.current = null;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [slashOpen, filteredSlash, slashIndex, insertBlock]);

  // ─────────────────────── AI selection popover ───────────────────────
  const handleSelectionAi = useCallback((ed: Editor) => {
    const { from, to, empty } = ed.state.selection;
    if (empty || to - from < 1) {
      setAiButtonCoords(null);
      setAiPopoverOpen(false);
      selectionRangeRef.current = null;
      return;
    }
    selectionRangeRef.current = { from, to };
    try {
      const start = ed.view.coordsAtPos(from);
      const end = ed.view.coordsAtPos(to);
      const x = (start.left + end.right) / 2;
      const y = Math.min(start.top, end.top) - 8;
      setAiButtonCoords({ x, y });
    } catch {
      setAiButtonCoords(null);
    }
  }, []);

  const openAiPopover = useCallback(() => {
    if (!aiButtonCoords) return;
    // Position popover above the ✨ button.
    setAiPopoverCoords({ x: aiButtonCoords.x, y: aiButtonCoords.y - 10 });
    setAiSubmenu('root');
    setAiPopoverOpen(true);
  }, [aiButtonCoords]);

  const closeAiPopover = useCallback(() => {
    setAiPopoverOpen(false);
    setAiSubmenu('root');
  }, []);

  const runAi = useCallback(
    (kind: keyof typeof AI_MOCK_RESPONSES, mode: 'replace' | 'after') => {
      if (!editor) return;
      const range = selectionRangeRef.current;
      if (!range) return;
      const text = AI_MOCK_RESPONSES[kind];
      if (!text) return;
      setAiThinking(true);
      // Brief sparkle pulse before applying
      setTimeout(() => {
        const chain = editor.chain().focus();
        if (mode === 'replace') {
          chain
            .insertContentAt(range, text)
            .run();
        } else {
          // Insert a new paragraph after the selection with the AI text.
          chain
            .setTextSelection(range.to)
            .insertContent('\n')
            .insertContent({
              type: 'paragraph',
              content: [{ type: 'text', text }],
            })
            .run();
        }
        setAiThinking(false);
        closeAiPopover();
      }, 650);
    },
    [editor, closeAiPopover]
  );

  // Close AI popover on Esc / outside-click
  useEffect(() => {
    if (!aiPopoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAiPopover();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aiPopoverOpen, closeAiPopover]);

  if (!editor) return null;

  return (
    <div className="relative w-full">
      <EditorContent editor={editor} />

      {/* AI ✨ floating button — appears above the selection */}
      <AnimatePresence>
        {aiButtonCoords && !aiPopoverOpen && (
          <motion.button
            key="ai-button"
            data-testid="ai-selection-button"
            initial={{ opacity: 0, scale: 0.6, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 6 }}
            transition={APPLE_SPRING}
            onMouseDown={(e) => {
              // Prevent selection loss when clicking.
              e.preventDefault();
              openAiPopover();
            }}
            className="fixed z-50 glass-strong h-9 w-9 rounded-full flex items-center justify-center active-elevate-2"
            style={{
              left: aiButtonCoords.x - 18,
              top: aiButtonCoords.y - 36,
              color: '#20B8A6',
            }}
            aria-label="AI actions"
          >
            <Sparkles size={16} strokeWidth={1.8} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* AI popover — glass menu */}
      <AnimatePresence>
        {aiPopoverOpen && aiPopoverCoords && (
          <>
            <motion.div
              key="ai-popover-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(e) => {
                e.preventDefault();
                closeAiPopover();
              }}
              className="fixed inset-0 z-40"
            />
            <AiPopover
              key="ai-popover"
              coords={aiPopoverCoords}
              submenu={aiSubmenu}
              setSubmenu={setAiSubmenu}
              thinking={aiThinking}
              onAction={runAi}
            />
          </>
        )}
      </AnimatePresence>

      {/* Slash menu */}
      <AnimatePresence>
        {slashOpen && slashCoords && filteredSlash.length > 0 && (
          <SlashMenu
            coords={slashCoords}
            items={filteredSlash}
            activeIndex={slashIndex}
            setActiveIndex={setSlashIndex}
            onSelect={(k) => insertBlock(k)}
            onClose={() => setSlashOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────── Slash menu ─────────────────────────
function SlashMenu({
  coords,
  items,
  activeIndex,
  setActiveIndex,
  onSelect,
  onClose,
}: {
  coords: { x: number; y: number };
  items: SlashItem[];
  activeIndex: number;
  setActiveIndex: (n: number) => void;
  onSelect: (k: BlockKind) => void;
  onClose: () => void;
}) {
  // Clamp horizontally so it doesn't escape the viewport
  const left = Math.min(
    Math.max(8, coords.x),
    typeof window !== 'undefined' ? window.innerWidth - 248 - 8 : 9999
  );
  const top = Math.min(
    coords.y,
    typeof window !== 'undefined' ? window.innerHeight - 320 - 8 : 9999
  );

  useEffect(() => {
    // Scroll active item into view
    const el = document.querySelector(`[data-slash-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <motion.div
      data-testid="slash-menu"
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={APPLE_SPRING}
      className="fixed z-50 glass-strong rounded-2xl p-1.5 shadow-2xl"
      style={{
        left,
        top,
        width: 248,
        maxHeight: 320,
        overflowY: 'auto',
        transformOrigin: 'top left',
      }}
      onMouseDown={(e) => {
        // Prevent the editor losing focus on click.
        e.preventDefault();
      }}
    >
      <div className="px-2 pt-1 pb-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-foreground/45">
        Blocks
      </div>
      {items.map((it, i) => {
        const I = it.icon;
        const active = i === activeIndex;
        return (
          <button
            key={it.key}
            data-slash-idx={i}
            data-testid={`slash-item-${it.key}`}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => onSelect(it.key)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left text-[13.5px] ${
              active
                ? 'bg-foreground/[0.07] dark:bg-white/[0.08]'
                : 'text-foreground/85'
            }`}
          >
            <span
              className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                active
                  ? 'bg-foreground/[0.06] dark:bg-white/[0.06] text-foreground'
                  : 'bg-foreground/[0.04] dark:bg-white/[0.04] text-foreground/75'
              }`}
            >
              <I size={14} strokeWidth={1.7} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium leading-tight text-foreground truncate">
                {it.label}
              </span>
              <span className="block text-[11.5px] leading-tight text-foreground/55 truncate">
                {it.hint}
              </span>
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}

// ───────────────────────── AI popover ─────────────────────────
function AiPopover({
  coords,
  submenu,
  setSubmenu,
  thinking,
  onAction,
}: {
  coords: { x: number; y: number };
  submenu: 'root' | 'translate';
  setSubmenu: (s: 'root' | 'translate') => void;
  thinking: boolean;
  onAction: (kind: keyof typeof AI_MOCK_RESPONSES, mode: 'replace' | 'after') => void;
}) {
  const W = 268;
  const left = Math.min(
    Math.max(8, coords.x - W / 2),
    typeof window !== 'undefined' ? window.innerWidth - W - 8 : 9999
  );
  // If the popover would go above the top of the viewport, flip below
  const wantsTop = coords.y - 280;
  const top = wantsTop > 12 ? wantsTop : coords.y + 30;

  const rootItems: {
    key: keyof typeof AI_MOCK_RESPONSES | 'translate';
    label: string;
    icon: LucideIcon;
    mode?: 'replace' | 'after';
    sub?: boolean;
  }[] = [
    { key: 'continue', label: 'Continue writing', icon: PenLine, mode: 'after' },
    { key: 'summarize', label: 'Summarize', icon: FileTextIcon, mode: 'replace' },
    { key: 'improve', label: 'Improve writing', icon: Wand2, mode: 'replace' },
    { key: 'fix', label: 'Fix grammar', icon: CheckCircle2, mode: 'replace' },
    { key: 'translate', label: 'Translate', icon: Globe, sub: true },
    { key: 'shorter', label: 'Make shorter', icon: Scissors, mode: 'replace' },
    { key: 'longer', label: 'Make longer', icon: Maximize2, mode: 'replace' },
  ];

  const translateItems: {
    key: keyof typeof AI_MOCK_RESPONSES;
    label: string;
  }[] = [
    { key: 'translate-en', label: 'English' },
    { key: 'translate-nl', label: 'Dutch' },
    { key: 'translate-es', label: 'Spanish' },
    { key: 'translate-fr', label: 'French' },
    { key: 'translate-de', label: 'German' },
  ];

  return (
    <motion.div
      data-testid="ai-popover"
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 4 }}
      transition={APPLE_SPRING}
      className="fixed z-50 glass-strong rounded-2xl p-1.5 shadow-2xl"
      style={{
        left,
        top,
        width: W,
        transformOrigin: 'top center',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-2 pt-1 pb-1.5 flex items-center gap-1.5">
        {submenu === 'translate' && (
          <button
            onClick={() => setSubmenu('root')}
            aria-label="Back"
            className="h-5 w-5 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
          >
            <ChevronRight size={12} strokeWidth={1.8} className="rotate-180" />
          </button>
        )}
        <Sparkles size={13} strokeWidth={1.8} className="text-icon-muted" />
        <span className="text-[10.5px] uppercase tracking-wider font-semibold text-foreground/55">
          {submenu === 'translate' ? 'Translate to…' : 'AI actions'}
        </span>
        {thinking && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="ml-auto text-[10.5px] text-foreground/70 font-medium"
          >
            Thinking…
          </motion.span>
        )}
      </div>

      {submenu === 'root' ? (
        <div className="flex flex-col gap-0.5">
          {rootItems.map((it) => {
            const I = it.icon;
            return (
              <button
                key={it.key}
                data-testid={`ai-action-${it.key}`}
                disabled={thinking}
                onClick={() => {
                  if (it.sub) setSubmenu('translate');
                  else if (it.mode) onAction(it.key as keyof typeof AI_MOCK_RESPONSES, it.mode);
                }}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-[13.5px] text-foreground/90 hover-elevate active-elevate-2 disabled:opacity-50 text-left"
              >
                <span className="h-6 w-6 rounded-lg flex items-center justify-center bg-foreground/[0.05] dark:bg-white/[0.05] text-foreground/85 shrink-0">
                  <I size={13} strokeWidth={1.7} />
                </span>
                <span className="flex-1">{it.label}</span>
                {it.sub && <ChevronRight size={13} strokeWidth={1.8} className="text-foreground/35" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {translateItems.map((it) => (
            <button
              key={it.key}
              data-testid={`ai-translate-${it.key}`}
              disabled={thinking}
              onClick={() => onAction(it.key, 'replace')}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-[13.5px] text-foreground/90 hover-elevate active-elevate-2 disabled:opacity-50 text-left"
            >
              <span className="h-6 w-6 rounded-lg flex items-center justify-center bg-foreground/[0.05] dark:bg-white/[0.05] text-foreground/75 shrink-0">
                <Globe size={13} strokeWidth={1.7} />
              </span>
              <span className="flex-1">{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
