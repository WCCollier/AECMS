import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LinkModal } from '@/components/editor/LinkModal';
import adminApi from '@/lib/adminApi';

jest.mock('@/lib/adminApi', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockGet = adminApi.get as jest.Mock;

const setup = (initialHref?: string) => {
  const onApply = jest.fn();
  render(
    <LinkModal isOpen initialHref={initialHref} onApply={onApply} onRemove={jest.fn()} onClose={jest.fn()} />,
  );
  return { onApply };
};

describe('LinkModal generated hrefs', () => {
  beforeEach(() => mockGet.mockReset());

  it('inserts the /shop route for a chosen product', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'p1', title: 'Outsiders Vol. I', slug: 'outsiders-vol-i' }] } });
    const { onApply } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Products/ }));
    fireEvent.click(await screen.findByText('Outsiders Vol. I'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith('/shop/outsiders-vol-i', '');
  });

  it('inserts the /articles route for a chosen article', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'a1', title: 'Hello', slug: 'hello' }] } });
    const { onApply } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Articles/ }));
    fireEvent.click(await screen.findByText('Hello'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith('/articles/hello', '');
  });

  it('inserts the full path for a nested page', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          { id: 'p1', title: 'About', slug: 'about', parent_id: null },
          { id: 'p2', title: 'Team', slug: 'team', parent_id: 'p1' },
        ],
      },
    });
    const { onApply } = setup();
    fireEvent.click(await screen.findByText('Team'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith('/about/team', '');
  });

  it('reopens an existing product link (current or legacy) on the Products tab', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    setup('/products/old-link');
    await waitFor(() => expect(screen.getByPlaceholderText('Search products…')).toBeInTheDocument());
  });
});
