import dynamicImport from 'next/dynamic';

export const dynamic = 'force-dynamic';

// Uses useEditor (TipTap) which requires a browser DOM — loaded client-side only
const MigrateContentClient = dynamicImport(
  () => import('./MigrateContentClient').then((m) => m.MigrateContentClient),
  { ssr: false },
);

export default function MigrateContentPage() {
  return <MigrateContentClient />;
}
