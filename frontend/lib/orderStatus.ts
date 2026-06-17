import type { OrderStatus } from '@/types';

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending:    'bg-yellow-500/10 text-yellow-600',
  processing: 'bg-blue-500/10 text-blue-600',
  scheduled:  'bg-indigo-500/10 text-indigo-600',
  shipped:    'bg-purple-500/10 text-purple-600',
  completed:  'bg-green-500/10 text-green-600',
  cancelled:  'bg-red-500/10 text-red-600',
  refunded:   'bg-gray-500/10 text-gray-500',
};

const STATUS_CLASSES_BORDERED: Record<OrderStatus, string> = {
  pending:    'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  processing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  scheduled:  'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  shipped:    'bg-purple-500/10 text-purple-600 border-purple-500/20',
  completed:  'bg-green-500/10 text-green-600 border-green-500/20',
  cancelled:  'bg-red-500/10 text-red-600 border-red-500/20',
  refunded:   'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export function orderStatusClass(status: string, bordered = false): string {
  const map = bordered ? STATUS_CLASSES_BORDERED : STATUS_CLASSES;
  return (map as Record<string, string>)[status] ?? STATUS_CLASSES.pending;
}
