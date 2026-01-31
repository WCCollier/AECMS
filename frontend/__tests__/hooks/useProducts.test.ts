import { renderHook, waitFor } from '@testing-library/react';
import { useProducts, useProduct } from '@/hooks/useProducts';
import useSWR from 'swr';

jest.mock('swr');

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;

describe('useProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty products array when loading', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useProducts());

    expect(result.current.products).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('returns products when data is loaded', () => {
    const mockProducts = [
      { id: '1', name: 'Product 1', slug: 'product-1' },
      { id: '2', name: 'Product 2', slug: 'product-2' },
    ];

    mockUseSWR.mockReturnValue({
      data: { data: mockProducts, total: 2, total_pages: 1 },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useProducts());

    expect(result.current.products).toEqual(mockProducts);
    expect(result.current.total).toBe(2);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns error state when request fails', () => {
    const mockError = new Error('Failed to fetch');

    mockUseSWR.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useProducts());

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(mockError);
    expect(result.current.products).toEqual([]);
  });

  it('builds correct query params with options', () => {
    mockUseSWR.mockReturnValue({
      data: { data: [], total: 0, total_pages: 0 },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    renderHook(() =>
      useProducts({
        page: 2,
        limit: 24,
        category: 'electronics',
        search: 'phone',
      })
    );

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.any(Function)
    );
    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('limit=24'),
      expect.any(Function)
    );
    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('category=electronics'),
      expect.any(Function)
    );
    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('search=phone'),
      expect.any(Function)
    );
  });

  it('uses default pagination values', () => {
    mockUseSWR.mockReturnValue({
      data: { data: [], total: 0, total_pages: 0 },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    renderHook(() => useProducts());

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('page=1'),
      expect.any(Function)
    );
    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('limit=12'),
      expect.any(Function)
    );
  });
});

describe('useProduct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null product when no id provided', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useProduct(undefined));

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
    expect(result.current.product).toBeUndefined();
  });

  it('fetches product by slug', () => {
    const mockProduct = { id: '1', name: 'Product 1', slug: 'product-1' };

    mockUseSWR.mockReturnValue({
      data: mockProduct,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useProduct('product-1'));

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/products/slug/product-1',
      expect.any(Function)
    );
    expect(result.current.product).toEqual(mockProduct);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns loading state', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useProduct('product-1'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.product).toBeUndefined();
  });

  it('returns error state', () => {
    const mockError = new Error('Product not found');

    mockUseSWR.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useProduct('invalid-slug'));

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(mockError);
  });
});
