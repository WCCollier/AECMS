import useSWR from 'swr';
import api from '@/lib/api';
import { fetcher } from '@/lib/swr';
import type { Order, PaginatedResponse, ShippingAddress } from '@/types';

interface UseOrdersOptions {
  page?: number;
  limit?: number;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { page = 1, limit = 10 } = options;

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Order>>(
    `/orders/my?${params.toString()}`,
    fetcher
  );

  return {
    orders: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.total_pages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useOrder(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Order>(
    id ? `/orders/${id}` : null,
    fetcher
  );

  return {
    order: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export interface CreateOrderData {
  shipping_address: ShippingAddress;
  billing_address?: ShippingAddress;
  guest_email?: string;
}

export async function createOrder(data: CreateOrderData): Promise<Order> {
  const response = await api.post<Order>('/orders', data);
  return response.data;
}
