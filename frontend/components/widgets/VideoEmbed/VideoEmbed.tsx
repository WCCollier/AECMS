import { Video } from 'lucide-react';

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
      let id = u.searchParams.get('v');
      if (!id && u.hostname === 'youtu.be') id = u.pathname.slice(1).split('?')[0];
      if (!id) {
        const m = u.pathname.match(/\/embed\/([^/?]+)/);
        if (m) id = m[1];
      }
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('vimeo.com')) {
      const m = u.pathname.match(/\/(\d+)/);
      return m ? `https://player.vimeo.com/video/${m[1]}` : null;
    }
  } catch {}
  return null;
}

export function VideoEmbed({ url }: { url: string }) {
  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div className="flex items-center gap-3 p-4 border border-border rounded-lg text-foreground/50 my-4">
        <Video className="w-6 h-6 flex-shrink-0" />
        <span className="text-sm">
          Unsupported video URL —{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
            open link
          </a>
        </span>
      </div>
    );
  }

  return (
    <div className="aspect-video rounded-lg overflow-hidden my-4 bg-black">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        title="Embedded video"
      />
    </div>
  );
}
