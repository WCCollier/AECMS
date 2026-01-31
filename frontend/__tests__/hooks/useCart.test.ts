import { renderHook, act } from '@testing-library/react';
import { useCart } from '@/hooks/useCart';
import useSWR from 'swr';

// Mock the API module
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

jest.mock('swr');

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;

describe('useCart', () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutate.mockResolvedValue(undefined);
  });

  it('returns empty cart when loading', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useCart());

    expect(result.current.cart).toBeUndefined();
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });

  it('returns cart data when loaded', () => {
    const mockCart = {
      id: 'cart-1',
      items: [
        { id: 'item-1', product_id: 'prod-1', quantity: 2, unit_price: 1000 },
        { id: 'item-2', product_id: 'prod-2', quantity: 1, unit_price: 2500 },
      ],
    };

    mockUseSWR.mockReturnValue({
      data: mockCart,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useCart());

    expect(result.current.cart).toEqual(mockCart);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.itemCount).toBe(3);
    expect(result.current.subtotal).toBe(4500);
    expect(result.current.isLoading).toBe(false);
  });

  it('calculates item count correctly', () => {
    const mockCart = {
      id: 'cart-1',
      items: [
        { id: 'item-1', product_id: 'prod-1', quantity: 5, unit_price: 100 },
        { id: 'item-2', product_id: 'prod-2', quantity: 3, unit_price: 200 },
      ],
    };

    mockUseSWR.mockReturnValue({
      data: mockCart,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useCart());

    expect(result.current.itemCount).toBe(8);
  });

  it('calculates subtotal correctly', () => {
    const mockCart = {
      id: 'cart-1',
      items: [
        { id: 'item-1', product_id: 'prod-1', quantity: 2, unit_price: 1500 },
        { id: 'item-2', product_id: 'prod-2', quantity: 3, unit_price: 500 },
      ],
    };

    mockUseSWR.mockReturnValue({
      data: mockCart,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useCart());

    expect(result.current.subtotal).toBe(4500);
  });

  describe('addItem', () => {
    it('calls API and mutates cart', async () => {
      mockUseSWR.mockReturnValue({
        data: { id: 'cart-1', items: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mockMutate,
      });

      mockPost.mockResolvedValue({
        data: { id: 'item-1', product_id: 'prod-1', quantity: 2 },
      });

      const { result } = renderHook(() => useCart());

      await act(async () => {
        await result.current.addItem('prod-1', 2);
      });

      expect(mockPost).toHaveBeenCalledWith('/cart/items', {
        product_id: 'prod-1',
        quantity: 2,
      });
      expect(mockMutate).toHaveBeenCalled();
    });

    it('defaults quantity to 1', async () => {
      mockUseSWR.mockReturnValue({
        data: { id: 'cart-1', items: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mockMutate,
      });

      mockPost.mockResolvedValue({
        data: { id: 'item-1', product_id: 'prod-1', quantity: 1 },
      });

      const { result } = renderHook(() => useCart());

      await act(async () => {
        await result.current.addItem('prod-1');
      });

      expect(mockPost).toHaveBeenCalledWith('/cart/items', {
        product_id: 'prod-1',
        quantity: 1,
      });
    });
  });

  describe('updateItem', () => {
    it('calls API and mutates cart', async () => {
      mockUseSWR.mockReturnValue({
        data: { id: 'cart-1', items: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mockMutate,
      });

      mockPatch.mockResolvedValue({
        data: { id: 'item-1', quantity: 5 },
      });

      const { result } = renderHook(() => useCart());

      await act(async () => {
        await result.current.updateItem('item-1', 5);
      });

      expect(mockPatch).toHaveBeenCalledWith('/cart/items/item-1', {
        quantity: 5,
      });
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('calls API and mutates cart', async () => {
      mockUseSWR.mockReturnValue({
        data: { id: 'cart-1', items: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mockMutate,
      });

      mockDelete.mockResolvedValue({});

      const { result } = renderHook(() => useCart());

      await act(async () => {
        await result.current.removeItem('item-1');
      });

      expect(mockDelete).toHaveBeenCalledWith('/cart/items/item-1');
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  describe('clearCart', () => {
    it('calls API and mutates cart', async () => {
      mockUseSWR.mockReturnValue({
        data: { id: 'cart-1', items: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mockMutate,
      });

      mockDelete.mockResolvedValue({});

      const { result } = renderHook(() => useCart());

      await act(async () => {
        await result.current.clearCart();
      });

      expect(mockDelete).toHaveBeenCalledWith('/cart');
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('returns error state when request fails', () => {
    const mockError = new Error('Failed to fetch cart');

    mockUseSWR.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useCart());

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(mockError);
  });
});
