import type { Metadata } from 'next';
import { ShopConfigClient } from './ShopConfigClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Shop Config' };

export default function ShopConfigPage() {
  return <ShopConfigClient />;
}
