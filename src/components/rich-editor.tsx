import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Link as LinkIcon, Undo, Redo, Pilcrow,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export function RichEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-cyan-glow underline" } }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-80 max-w-none px-3 py-3 rounded-md bg-input border border-border focus:border-primary focus:outline-none prose prose-invert prose-headings:font-display prose-headings:font-bold text-foreground/90",
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep the editor in sync when the parent replaces `value` (e.g. loading an edit).
  useEffect(() => {
    if (!editor) return;
    if (value && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded border text-sm transition-colors " +
    (active ? "border-primary text-cyan-glow bg-primary/10" : "border-border hover:border-primary");

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card/60 p-1.5">
      <button type="button" title="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>
        <Heading1 className="h-4 w-4" />
      </button>
      <button type="button" title="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>
        <Heading2 className="h-4 w-4" />
      </button>
      <button type="button" title="Título 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))}>
        <Heading3 className="h-4 w-4" />
      </button>
      <button type="button" title="Parágrafo" onClick={() => editor.chain().focus().setParagraph().run()} className={btn(editor.isActive("paragraph"))}>
        <Pilcrow className="h-4 w-4" />
      </button>
      <span className="w-px bg-border mx-1" />
      <button type="button" title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" title="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))}>
        <Strikethrough className="h-4 w-4" />
      </button>
      <button type="button" title="Código" onClick={() => editor.chain().focus().toggleCode().run()} className={btn(editor.isActive("code"))}>
        <Code className="h-4 w-4" />
      </button>
      <span className="w-px bg-border mx-1" />
      <button type="button" title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
        <List className="h-4 w-4" />
      </button>
      <button type="button" title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
        <ListOrdered className="h-4 w-4" />
      </button>
      <button type="button" title="Citação" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>
        <Quote className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Link"
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL do link", prev ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
        className={btn(editor.isActive("link"))}
      >
        <LinkIcon className="h-4 w-4" />
      </button>
      <span className="w-px bg-border mx-1" />
      <button type="button" title="Desfazer" onClick={() => editor.chain().focus().undo().run()} className={btn(false)}>
        <Undo className="h-4 w-4" />
      </button>
      <button type="button" title="Refazer" onClick={() => editor.chain().focus().redo().run()} className={btn(false)}>
        <Redo className="h-4 w-4" />
      </button>
    </div>
  );
}