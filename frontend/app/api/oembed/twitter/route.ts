export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return Response.json({ error: 'url required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      return Response.json({ error: 'upstream fetch failed' }, { status: 502 });
    }
    const data = await res.json();
    return Response.json({
      author_name: data.author_name ?? '',
      author_url: data.author_url ?? '',
      html: data.html ?? '',
    });
  } catch {
    return Response.json({ error: 'fetch failed' }, { status: 502 });
  }
}
