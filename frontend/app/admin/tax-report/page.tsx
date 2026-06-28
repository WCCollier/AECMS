import type { Metadata } from 'next';
import { TaxReportClient } from './TaxReportClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tax Report' };

export default function TaxReportPage() {
  return <TaxReportClient />;
}
