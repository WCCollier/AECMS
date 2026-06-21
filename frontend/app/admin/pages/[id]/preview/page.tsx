import { PreviewPageClient } from './PreviewPageClient';

export const dynamic = 'force-dynamic';

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PreviewPageClient pageId={id} />;
}
