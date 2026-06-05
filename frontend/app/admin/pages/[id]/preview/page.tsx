import { PreviewPageClient } from './PreviewPageClient';

export const dynamic = 'force-dynamic';

export default function PreviewPage({ params }: { params: { id: string } }) {
  return <PreviewPageClient pageId={params.id} />;
}
