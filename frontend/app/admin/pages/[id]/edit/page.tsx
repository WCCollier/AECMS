import { EditPageClient } from './EditPageClient';

export const dynamic = 'force-dynamic';

export default function EditPagePage({ params }: { params: { id: string } }) {
  return <EditPageClient pageId={params.id} />;
}
