export const dynamic = 'force-dynamic';

import { SettingsClient } from './SettingsClient';

export const metadata = { title: 'Settings — Admin' };

export default function SettingsPage() {
  return <SettingsClient />;
}
