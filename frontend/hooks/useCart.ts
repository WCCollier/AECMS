import useSWR from 'swr';
import api from '@/lib/api';
import { fetcher } from '@/lib/swr';
import type { Cart, CartItem } from '@/types';

export function useCart() {
  const { data, error, isLoading, mutate } = useSWR<Cart>('/cart', fetcher);

  const addItem = async (productId: string, quantity: number = 1) => {
    const response = await api.post<CartItem>('/cart/items', {
      product_id: productId,
      quantity,
    });
    await mutate();
    return response.data;
  };

  const updateItem = async (itemId: string, quantity: number) => {
    const response = await api.patch<CartItem>(`/cart/items/${itemId}`, {
      quantity,
    });
    await mutate();
    return response.data;
  };

  const removeItem = async (itemId: string) => {
    await api.delete(`/cart/items/${itemId}`);
    await mutate();
  };

  const clearCart = async () => {
    await api.delete('/cart');
    await mutate();
  };

  const itemCount = data?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const subtotal = data?.items?.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) ?? 0;

  return {
    cart: data,
    items: data?.items ?? [],
    itemCount,
    subtotal,
    isLoading,
    isError: !!error,
    error,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    mutate,
  };
}
