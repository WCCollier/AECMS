export const dynamic = 'force-dynamic';

import { AdminOrderDetailClient } from './AdminOrderDetailClient';

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetailClient orderId={id} />;
}
