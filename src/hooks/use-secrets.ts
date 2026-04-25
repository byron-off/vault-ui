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
  deleteSecretV1,
  type KVCtx,
} from '@/lib/vault/api/secrets';

export function useSecretList(ctx: KVCtx, path: string, enabled = true) {
  return useQuery({
    queryKey: ['secrets', ctx.mount, 'list', path],
    queryFn: () => listSecrets(ctx, path),
    enabled,
  });
}

export function useSecret(ctx: KVCtx, path: string, version?: number, enabled = true) {
  return useQuery({
    queryKey: ['secrets', ctx.mount, 'read', path, version],
    queryFn: () => readSecret(ctx, path, version),
    enabled,
  });
}

export function useSecretMetadata(ctx: KVCtx, path: string, enabled = true) {
  return useQuery({
    queryKey: ['secrets', ctx.mount, 'metadata', path],
    queryFn: () => getSecretMetadata(ctx, path),
    enabled,
  });
}

export function useWriteSecret(ctx: KVCtx) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, data, cas }: { path: string; data: Record<string, string>; cas?: number }) =>
      writeSecret(ctx, path, data, cas),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'list'] });
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'read', path] });
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'metadata', path] });
    },
  });
}

export function useUpdateSecretMetadata(ctx: KVCtx) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      opts,
    }: {
      path: string;
      opts: { max_versions?: number; cas_required?: boolean; custom_metadata?: Record<string, string> };
    }) => updateSecretMetadata(ctx, path, opts),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'metadata', path] });
    },
  });
}

export function useSoftDeleteVersions(ctx: KVCtx) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, versions }: { path: string; versions: number[] }) =>
      softDeleteSecretVersions(ctx, path, versions),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'metadata', path] });
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'read', path] });
    },
  });
}

export function useUndeleteVersions(ctx: KVCtx) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, versions }: { path: string; versions: number[] }) =>
      undeleteSecretVersions(ctx, path, versions),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'metadata', path] });
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'read', path] });
    },
  });
}

export function useDestroyVersions(ctx: KVCtx) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, versions }: { path: string; versions: number[] }) =>
      destroySecretVersions(ctx, path, versions),
    onSuccess: (_, { path }) => {
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'metadata', path] });
    },
  });
}

export function useDeleteSecretMetadata(ctx: KVCtx) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) =>
      ctx.isV1 ? deleteSecretV1(ctx, path) : deleteSecretMetadata(ctx, path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['secrets', ctx.mount, 'list'] });
    },
  });
}
