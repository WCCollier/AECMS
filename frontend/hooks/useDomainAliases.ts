import useSWR from 'swr';
import { adminFetcher } from '@/lib/swr';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import type { DomainAlias, DomainAliasCreateData, DomainVerificationInstructions } from '@/types';

export function useDomainAliases() {
  const { data, error, isLoading, mutate } = useSWR<DomainAlias[]>(
    '/domain-aliases',
    adminFetcher
  );

  return {
    domainAliases: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useDomainAlias(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<DomainAlias>(
    id ? `/domain-aliases/${id}` : null,
    adminFetcher
  );

  return {
    domainAlias: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useDomainVerificationInstructions(id: string | undefined) {
  const { data, error, isLoading } = useSWR<DomainVerificationInstructions>(
    id ? `/domain-aliases/${id}/instructions` : null,
    adminFetcher
  );

  return {
    instructions: data,
    isLoading,
    isError: !!error,
    error,
  };
}

export async function createDomainAlias(data: DomainAliasCreateData): Promise<DomainAlias> {
  try {
    const response = await adminApi.post<DomainAlias>('/domain-aliases', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateDomainAlias(id: string, data: Partial<DomainAlias>): Promise<DomainAlias> {
  try {
    const response = await adminApi.patch<DomainAlias>(`/domain-aliases/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function deleteDomainAlias(id: string): Promise<void> {
  try {
    await adminApi.delete(`/domain-aliases/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function verifyDomainAlias(id: string): Promise<DomainAlias> {
  try {
    const response = await adminApi.post<DomainAlias>(`/domain-aliases/${id}/verify`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
