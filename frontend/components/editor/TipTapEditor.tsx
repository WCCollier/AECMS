'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote,
  Undo, Redo, Link as LinkIcon, Unlink, Heading1, Heading2, Heading3,
  Minus, ImagePlus, X, Upload, Info, Video, Twitter, GalleryHorizontal,
  FileText, ShoppingBag, Square,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { getEditorExtensions } from './extensions';
import { MediaGalleryField } from '@/components/widgets/MediaGallery/MediaGalleryField';
import type { GalleryEntry } from '@/components/widgets/MediaGallery/MediaGalleryField';
import type { MediaItem } from '@/types';

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

type ActivePanel = 'image' | 'carousel' | null;

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
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Image insert state
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carousel insert state
  const [carouselEntries, setCarouselEntries] = useState<GalleryEntry[]>([]);

  // content is stored as JSON.stringify(doc) — parse it back so TipTap
  // receives an object, not a raw JSON string (which it treats as HTML).
  const initialContent = (() => {
    if (!content) return '';
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && parsed.type === 'doc') return parsed;
    } catch {
      // legacy HTML string — fall through
    }
    return content;
  })();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: getEditorExtensions(),
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(JSON.stringify(e.getJSON()));
    },
  });

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setUploadError(null);
  };

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
    setActivePanel(null);
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

      const url = `/uploads/${response.data.file_path.split('/uploads/')[1]}`;
      editor.chain().focus().setImage({ src: url, alt: imageAlt.trim() || file.name }).run();
      setImageUrl('');
      setImageAlt('');
      setActivePanel(null);
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

  const insertCarousel = useCallback(() => {
    if (!editor || carouselEntries.length === 0) return;
    const mediaItems: MediaItem[] = carouselEntries.map((e, i) => ({
      id: e.mediaId,
      url: e.url,
      order: i,
      is_primary: e.isPrimary,
      alt_text: null,
    }));
    editor.chain().focus().insertContent({
      type: 'mediaCarousel',
      attrs: { media: JSON.stringify(mediaItems) },
    }).run();
    setCarouselEntries([]);
    setActivePanel(null);
  }, [editor, carouselEntries]);

  const insertCallout = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'callout',
      attrs: { type: 'info' },
      content: [{ type: 'paragraph' }],
    }).run();
  }, [editor]);

  const insertVideo = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'videoEmbed',
      attrs: { url: '' },
    }).run();
  }, [editor]);

  const insertXEmbed = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'xEmbed',
      attrs: { url: '' },
    }).run();
  }, [editor]);

  const insertRichTextBox = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'richTextBox',
      content: [{ type: 'paragraph' }],
    }).run();
  }, [editor]);

  const insertArticleEmbed = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'articleEmbed',
      attrs: { articleId: '' },
    }).run();
  }, [editor]);

  const insertProductEmbed = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'productEmbed',
      attrs: { productId: '' },
    }).run();
  }, [editor]);

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

        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align left">
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align center">
          <AlignCenter className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align right">
          <AlignRight className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />

        <MenuButton onClick={setLink} isActive={editor.isActive('link')} title="Add link">
          <LinkIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} title="Remove link">
          <Unlink className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />

        {/* Inline image */}
        <MenuButton onClick={() => togglePanel('image')} isActive={activePanel === 'image'} title="Insert inline image">
          <ImagePlus className="w-4 h-4" />
        </MenuButton>

        {/* Media carousel */}
        <MenuButton onClick={() => { setCarouselEntries([]); togglePanel('carousel'); }} isActive={activePanel === 'carousel'} title="Insert media carousel">
          <GalleryHorizontal className="w-4 h-4" />
        </MenuButton>

        {/* Callout */}
        <MenuButton onClick={insertCallout} title="Insert callout block">
          <Info className="w-4 h-4" />
        </MenuButton>

        {/* Video embed */}
        <MenuButton onClick={insertVideo} title="Insert video embed">
          <Video className="w-4 h-4" />
        </MenuButton>

        {/* X / Twitter embed */}
        <MenuButton onClick={insertXEmbed} title="Insert X / Twitter post">
          <Twitter className="w-4 h-4" />
        </MenuButton>

        {/* Rich Text Box */}
        <MenuButton onClick={insertRichTextBox} title="Insert rich text box">
          <Square className="w-4 h-4" />
        </MenuButton>

        {/* Article embed */}
        <MenuButton onClick={insertArticleEmbed} title="Embed article">
          <FileText className="w-4 h-4" />
        </MenuButton>

        {/* Product embed */}
        <MenuButton onClick={insertProductEmbed} title="Embed product">
          <ShoppingBag className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />

        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)">
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* ── Inline image insert panel ── */}
      {activePanel === 'image' && (
        <div className="border-b border-border bg-surface p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Insert Image</span>
            <button type="button" onClick={() => setActivePanel(null)} className="text-foreground/40 hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Alt text (optional)"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
          />

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste image URL…"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && insertImageFromUrl()}
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

          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
        </div>
      )}

      {/* ── Media carousel insert panel ── */}
      {activePanel === 'carousel' && (
        <div className="border-b border-border bg-surface p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Insert Media Carousel</span>
            <button type="button" onClick={() => setActivePanel(null)} className="text-foreground/40 hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <MediaGalleryField value={carouselEntries} onChange={setCarouselEntries} />

          <button
            type="button"
            onClick={insertCarousel}
            disabled={carouselEntries.length === 0}
            className="w-full px-3 py-2 text-sm bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Insert Carousel ({carouselEntries.length} image{carouselEntries.length !== 1 ? 's' : ''})
          </button>
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
