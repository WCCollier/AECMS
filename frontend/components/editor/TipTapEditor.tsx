'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useCallback, useRef, useState } from 'react';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote,
  Undo, Redo, Link as LinkIcon, Unlink, Heading1, Heading2, Heading3,
  Minus, ImagePlus, X, Upload,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

interface MenuButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}

function MenuButton({ onClick, isActive, disabled, children, title }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-foreground/10 transition-colors ${
        isActive ? 'bg-foreground/20 text-foreground' : 'text-foreground/60'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="w-px h-6 bg-foreground/20 mx-1" />;
}

export function TipTapEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  className = '',
}: TipTapEditorProps) {
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent underline hover:text-accent-hover' },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full my-4',
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertImageFromUrl = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim(), alt: imageAlt.trim() }).run();
    setImageUrl('');
    setImageAlt('');
    setShowImagePanel(false);
  }, [editor, imageUrl, imageAlt]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (imageAlt.trim()) formData.append('altText', imageAlt.trim());

      const response = await api.post<{ id: string; file_path: string; filename: string }>(
        '/media/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      // Construct the proxied URL from the filename
      const url = `/uploads/${response.data.file_path.split('/uploads/')[1]}`;
      editor.chain().focus().setImage({ src: url, alt: imageAlt.trim() || file.name }).run();
      setImageUrl('');
      setImageAlt('');
      setShowImagePanel(false);
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }, [editor, imageAlt]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  }, [handleFileUpload]);

  if (!editor) {
    return (
      <div className={`border border-border rounded-lg ${className}`}>
        <div className="h-12 bg-surface animate-pulse" />
        <div className="min-h-[200px] p-4">
          <div className="h-4 bg-surface-raised rounded w-3/4 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-surface">
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Inline code">
          <Code className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />

        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />

        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet list">
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote">
          <Quote className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />

        <MenuButton onClick={setLink} isActive={editor.isActive('link')} title="Add link">
          <LinkIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} title="Remove link">
          <Unlink className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />

        {/* Image insert */}
        <MenuButton
          onClick={() => { setShowImagePanel(!showImagePanel); setUploadError(null); }}
          isActive={showImagePanel}
          title="Insert image"
        >
          <ImagePlus className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />

        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)">
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Image insert panel */}
      {showImagePanel && (
        <div className="border-b border-border bg-surface p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Insert Image</span>
            <button type="button" onClick={() => setShowImagePanel(false)} className="text-foreground/40 hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Alt text (optional)"
            value={imageAlt}
            onChange={e => setImageAlt(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
          />

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste image URL…"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && insertImageFromUrl()}
              className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={insertImageFromUrl}
              disabled={!imageUrl.trim()}
              className="px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent-hover disabled:opacity-40 transition-colors"
            >
              Insert
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-foreground/40">
            <div className="flex-1 h-px bg-border" />
            <span>or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-surface-raised hover:border-accent/30 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Upload from device'}
          </button>

          {uploadError && (
            <p className="text-xs text-red-400">{uploadError}</p>
          )}
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
