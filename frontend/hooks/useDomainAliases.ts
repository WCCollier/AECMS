import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import api, { getErrorMessage } from '@/lib/api';
import type { DomainAlias, DomainAliasCreateData, DomainVerificationInstructions } from '@/types';

export function useDomainAliases() {
  const { data, error, isLoading, mutate } = useSWR<DomainAlias[]>(
    '/domain-aliases',
    fetcher
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
    fetcher
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
    fetcher
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
    const response = await api.post<DomainAlias>('/domain-aliases', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateDomainAlias(id: string, data: Partial<DomainAlias>): Promise<DomainAlias> {
  try {
    const response = await api.patch<DomainAlias>(`/domain-aliases/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function deleteDomainAlias(id: string): Promise<void> {
  try {
    await api.delete(`/domain-aliases/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function verifyDomainAlias(id: string): Promise<DomainAlias> {
  try {
    const response = await api.post<DomainAlias>(`/domain-aliases/${id}/verify`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
