import type { Metadata } from 'next';
import { TagEditorClient } from './TagEditorClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tags',
};

export default function TagsPage() {
  return <TagEditorClient />;
}
