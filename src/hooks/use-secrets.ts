'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSecrets,
  readSecret,
  writeSecret,
  getSecretMetadata,
  updateSecretMetadata,
  softDeleteSecretVersions,
  undeleteSecretVersions,
  destroySecretVersions,
  deleteSecretMetadata,
} from '@/lib/vault/api/secrets';

export function useSecretList(path: string, enabled = true) {
  return useQuery({
    queryKey: ['secrets', 'list', path],
    queryFn: () => listSecrets(path),
    enabled,
  });
}

export function useSecret(path: string, version?: number, enabled = true) {
  return useQuery({
    queryKey: ['secrets', 'read', path, version],
    queryFn: () => readSecret(path, version),
    enabled,
  });
}

export function useSecretMetadata(path: string, enabled = true) {
  return useQuery({
    queryKey: ['secrets', 'metadata', path],
    queryFn: () => getSecretMetadata(path),
    enabled,
  });
}

export function useWriteSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, data, cas }: { path: string; data: Record<string, string>; cas?: number }) =>
      writeSecret(path, data, cas),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', 'list'] });
      qc.invalidateQueries({ queryKey: ['secrets', 'read', path] });
      qc.invalidateQueries({ queryKey: ['secrets', 'metadata', path] });
    },
  });
}

export function useUpdateSecretMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      opts,
    }: {
      path: string;
      opts: { max_versions?: number; cas_required?: boolean; custom_metadata?: Record<string, string> };
    }) => updateSecretMetadata(path, opts),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', 'metadata', path] });
    },
  });
}

export function useSoftDeleteVersions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, versions }: { path: string; versions: number[] }) =>
      softDeleteSecretVersions(path, versions),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', 'metadata', path] });
      qc.invalidateQueries({ queryKey: ['secrets', 'read', path] });
    },
  });
}

export function useUndeleteVersions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, versions }: { path: string; versions: number[] }) =>
      undeleteSecretVersions(path, versions),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', 'metadata', path] });
      qc.invalidateQueries({ queryKey: ['secrets', 'read', path] });
    },
  });
}

export function useDestroyVersions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, versions }: { path: string; versions: number[] }) =>
      destroySecretVersions(path, versions),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', 'metadata', path] });
    },
  });
}

export function useDeleteSecretMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => deleteSecretMetadata(path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['secrets', 'list'] });
    },
  });
}
