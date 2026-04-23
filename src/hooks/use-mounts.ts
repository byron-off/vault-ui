'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMounts,
  enableMount,
  disableMount,
  listAuthMounts,
  enableAuthMethod,
  disableAuthMethod,
} from '@/lib/vault/api/mounts';

export function useMounts() {
  return useQuery({
    queryKey: ['mounts', 'secret'],
    queryFn: listMounts,
  });
}

export function useEnableMount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      opts,
    }: {
      path: string;
      opts: { type: string; description?: string; options?: Record<string, string> };
    }) => enableMount(path, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mounts', 'secret'] });
    },
  });
}

export function useDisableMount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => disableMount(path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mounts', 'secret'] });
    },
  });
}

export function useAuthMounts() {
  return useQuery({
    queryKey: ['mounts', 'auth'],
    queryFn: listAuthMounts,
  });
}

export function useEnableAuthMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      opts,
    }: {
      path: string;
      opts: { type: string; description?: string; config?: Record<string, unknown> };
    }) => enableAuthMethod(path, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mounts', 'auth'] });
    },
  });
}

export function useDisableAuthMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => disableAuthMethod(path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mounts', 'auth'] });
    },
  });
}
