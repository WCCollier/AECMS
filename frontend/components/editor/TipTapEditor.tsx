'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote,
  Undo, Redo, Link as LinkIcon, Unlink, Heading1, Heading2, Heading3,
  Minus, ImagePlus, X, Upload, Info, Video, Twitter, GalleryHorizontal,
  FileText, ShoppingBag, Square, Rss, LibraryBig,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Type,
} from 'lucide-react';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import { getEditorExtensions } from './extensions';
import { LinkModal } from './LinkModal';
import { MediaGalleryField } from '@/components/widgets/MediaGallery/MediaGalleryField';
import type { GalleryEntry } from '@/components/widgets/MediaGallery/MediaGalleryField';
import type { MediaItem } from '@/types';
import { CURATED_FONTS } from '@/lib/fonts';

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
  const [linkModalOpen, setLinkModalOpen] = useState(false);

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
    setLinkModalOpen(true);
  }, [editor]);

  const applyLink = useCallback((href: string, target: string) => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href, target: target || null }).run();
    setLinkModalOpen(false);
  }, [editor]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkModalOpen(false);
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

      const response = await adminApi.post<{ id: string; url: string; filename: string }>(
        '/media/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      const url = response.data.url;
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

  const insertRssEmbed = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'rssEmbed',
      attrs: { feedUrl: '' },
    }).run();
  }, [editor]);

  const insertSearchResultsEmbed = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'searchResultsEmbed',
      attrs: { contentType: 'articles', tags: '[]', tagLogic: 'and', search: '', display: 'grid', pageSize: 6, title: '' },
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
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Justify (newspaper)">
          <AlignJustify className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleDropCap().run()}
          isActive={editor.isActive({ dropCap: true })}
          title="Drop cap — place cursor in a paragraph and click to toggle"
        >
          <Type className="w-4 h-4" />
        </MenuButton>

        {/* Label style: uppercase + wide-tracking preset */}
        <MenuButton
          onClick={() => {
            const isLabel = editor.getAttributes('textStyle').textTransform === 'uppercase';
            if (isLabel) {
              editor.chain().focus().setMark('textStyle', { textTransform: null, letterSpacing: null }).run();
            } else {
              editor.chain().focus().setMark('textStyle', { textTransform: 'uppercase', letterSpacing: 'wide' }).run();
            }
          }}
          isActive={editor.getAttributes('textStyle').textTransform === 'uppercase'}
          title="Label style — UPPERCASE + wide tracking (eyebrows, captions)"
        >
          <span className="text-[10px] font-bold tracking-wider leading-none">AA</span>
        </MenuButton>

        {/* Letter spacing fine-control */}
        <select
          value={editor.getAttributes('textStyle').letterSpacing ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            editor.chain().focus().setMark('textStyle', { letterSpacing: val || null }).run();
          }}
          className="text-[10px] h-7 px-1 border border-border rounded bg-background cursor-pointer"
          title="Letter spacing"
        >
          <option value="" disabled>Spacing</option>
          <option value="tight">Tight</option>
          <option value="normal">Normal</option>
          <option value="wide">Wide</option>
          <option value="wider">Wider</option>
        </select>

        {/* Inline text color */}
        <div className="flex items-center gap-0.5" title="Text color">
          <input
            type="color"
            value={editor.getAttributes('textStyle').color ?? '#000000'}
            onChange={(e) => {
              editor.chain().focus().setMark('textStyle', { color: e.target.value }).run();
            }}
            className="w-6 h-6 p-0.5 border border-border rounded cursor-pointer bg-background"
          />
          <button
            type="button"
            onClick={() => editor.chain().focus().setMark('textStyle', { color: null }).run()}
            className="text-[10px] text-foreground/40 hover:text-foreground leading-none px-0.5"
            title="Clear text color"
          >×</button>
        </div>

        {/* Per-run font family — draws from curated library */}
        <select
          value={editor.getAttributes('textStyle').fontFamily ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              editor.chain().focus().unsetFontFamily().run();
            } else {
              editor.chain().focus().setFontFamily(val).run();
            }
          }}
          className="text-[10px] h-7 px-1 border border-border rounded bg-background cursor-pointer max-w-[140px] truncate"
          title="Per-run font family (font must be imported via Page Fonts to render correctly)"
        >
          <option value="" disabled>Font</option>
          {CURATED_FONTS.filter(f => !f.isSystem).flatMap(f => [
            { label: `${f.name} (heading)`, value: f.headingFamily },
            { label: `${f.name} (body)`, value: f.bodyFamily },
          ]).filter((opt, idx, arr) => arr.findIndex(o => o.value === opt.value) === idx)
            .map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))
          }
        </select>

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

        {/* RSS Feed embed */}
        <MenuButton onClick={insertRssEmbed} title="Embed RSS feed">
          <Rss className="w-4 h-4" />
        </MenuButton>

        {/* Collection embed */}
        <MenuButton onClick={insertSearchResultsEmbed} title="Embed content collection (tag/search query)">
          <LibraryBig className="w-4 h-4" />
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

      {/* Link insertion modal */}
      <LinkModal
        isOpen={linkModalOpen}
        initialHref={editor.getAttributes('link').href}
        initialTarget={editor.getAttributes('link').target ?? ''}
        onApply={applyLink}
        onRemove={removeLink}
        onClose={() => setLinkModalOpen(false)}
      />
    </div>
  );
}
