import { render, screen } from '@testing-library/react';
import { OrderConfirmationClient } from '@/app/(site)/order-confirmation/OrderConfirmationClient';
import { useOrder } from '@/hooks/useOrders';

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => 'order-1' }),
}));
jest.mock('@/hooks/useOrders', () => ({ useOrder: jest.fn() }));
jest.mock('@/components/digital/DigitalDownloadsPanel', () => ({
  DigitalDownloadsPanel: () => <div>downloads-panel</div>,
}));

const mockUseOrder = useOrder as jest.Mock;

const order = (status: string, extra: any = {}) => ({
  id: 'order-1',
  order_number: 'ORD-TEST',
  status,
  subtotal: 1.99,
  total: 1.99,
  shipping: 0,
  tax_amount: null,
  items: [
    { id: 'i1', product_name: 'Book', unit_price: 1.99, quantity: 1, total_price: 1.99, product: { product_type: 'digital' } },
  ],
  ...extra,
});

const withOrder = (o: any) =>
  mockUseOrder.mockReturnValue({ order: o, isLoading: false, isError: false });

describe('OrderConfirmationClient', () => {
  it('shows a confirming state, not "Order Confirmed", while payment is pending', () => {
    withOrder(order('pending'));
    render(<OrderConfirmationClient />);
    expect(screen.getByText(/Confirming your payment/)).toBeInTheDocument();
    expect(screen.queryByText('Order Confirmed!')).not.toBeInTheDocument();
    expect(screen.queryByText('downloads-panel')).not.toBeInTheDocument();
  });

  it('polls while pending and stops once the order is paid', () => {
    withOrder(order('pending'));
    render(<OrderConfirmationClient />);
    const { refreshInterval } = mockUseOrder.mock.calls[0][1];
    expect(refreshInterval(order('pending'))).toBe(2000);
    expect(refreshInterval(order('completed'))).toBe(0);
  });

  it('shows Order Confirmed and downloads once paid', () => {
    withOrder(order('completed'));
    render(<OrderConfirmationClient />);
    expect(screen.getByText('Order Confirmed!')).toBeInTheDocument();
    expect(screen.getByText('downloads-panel')).toBeInTheDocument();
    expect(screen.getByText('Payment confirmed.')).toBeInTheDocument();
  });

  it('does not call a cancelled order confirmed', () => {
    withOrder(order('cancelled'));
    render(<OrderConfirmationClient />);
    expect(screen.getByText('Order cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Order Confirmed!')).not.toBeInTheDocument();
  });
});
