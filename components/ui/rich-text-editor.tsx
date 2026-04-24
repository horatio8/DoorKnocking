"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Link as LinkIcon,
  Code2,
} from "lucide-react";

// Editor used for info screens inside the survey runner. Default surface
// is a TipTap WYSIWYG (rich text), with a toggle that swaps to a raw
// HTML <textarea> so authors can paste in HTML from elsewhere or hand-
// tune markup the buttons don't expose.
//
// Owns no submission logic — the parent passes `value` + `onChange` and
// persists the HTML string wherever it likes.

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 160 }: Props) {
  const [mode, setMode] = useState<"rich" | "html">("rich");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none",
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    // Avoid SSR hydration mismatch — TipTap renders client-side only.
    immediatelyRender: false,
  });

  // Keep the editor's internal content in sync when parent swaps value
  // (e.g. loading a different survey question into the same editor).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className="rounded-md border border-input bg-white">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div className="flex gap-1">
          {mode === "rich" ? (
            <>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBold().run()}
                active={editor?.isActive("bold") ?? false}
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                active={editor?.isActive("italic") ?? false}
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor?.isActive("heading", { level: 2 }) ?? false}
                title="Heading"
              >
                <Heading2 className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                active={editor?.isActive("bulletList") ?? false}
                title="Bulleted list"
              >
                <List className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                active={editor?.isActive("orderedList") ?? false}
                title="Numbered list"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                active={editor?.isActive("blockquote") ?? false}
                title="Quote"
              >
                <Quote className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  const prev = editor?.getAttributes("link").href as string | undefined;
                  const url = window.prompt("Link URL", prev ?? "https://");
                  if (url === null) return;
                  if (url === "") {
                    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
                  } else {
                    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                  }
                }}
                active={editor?.isActive("link") ?? false}
                title="Link"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </ToolbarButton>
            </>
          ) : (
            <span className="px-1 text-[11px] font-medium uppercase tracking-widest text-navy-500">
              Raw HTML
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "rich" ? "html" : "rich"))}
          className="inline-flex items-center gap-1 rounded border border-navy-200 bg-white px-2 py-1 text-[11px] font-medium text-navy-700 hover:bg-navy-50"
          title={mode === "rich" ? "Edit HTML directly" : "Back to rich text"}
        >
          <Code2 className="h-3 w-3" />
          {mode === "rich" ? "HTML" : "Rich text"}
        </button>
      </div>
      {mode === "rich" ? (
        <div className="px-3 py-2">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "<p>Your HTML here</p>"}
          style={{ minHeight }}
          className="block w-full resize-y bg-white px-3 py-2 font-mono text-[12px] text-navy-900 focus:outline-none"
        />
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded text-navy-700 transition ${
        active ? "bg-navy-100 text-navy-900" : "hover:bg-navy-50"
      }`}
    >
      {children}
    </button>
  );
}
