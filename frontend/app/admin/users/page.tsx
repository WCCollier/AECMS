export const dynamic = 'force-dynamic';
import { UsersClient } from './UsersClient';

export const metadata = { title: 'Users — Admin' };

export default function UsersPage() {
  return <UsersClient />;
}
