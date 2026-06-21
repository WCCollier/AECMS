export const dynamic = 'force-dynamic';

import { AuditLogClient } from './AuditLogClient';

export const metadata = { title: 'Audit Log — Admin' };

export default function AuditLogPage() {
  return <AuditLogClient />;
}
