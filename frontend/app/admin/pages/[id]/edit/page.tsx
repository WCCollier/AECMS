import { EditPageClient } from './EditPageClient';

export const dynamic = 'force-dynamic';

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditPageClient pageId={id} />;
}
