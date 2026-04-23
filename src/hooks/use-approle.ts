'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAppRoles,
  getAppRole,
  createAppRole,
  deleteAppRole,
  getRoleId,
  generateSecretId,
  listSecretIdAccessors,
  destroySecretId,
} from '@/lib/vault/api/approle';

export function useAppRoles(mount = 'approle') {
  return useQuery({
    queryKey: ['approle', mount, 'list'],
    queryFn: () => listAppRoles(mount),
  });
}

export function useAppRole(name: string, mount = 'approle', enabled = true) {
  return useQuery({
    queryKey: ['approle', mount, 'role', name],
    queryFn: () => getAppRole(name, mount),
    enabled: enabled && !!name,
  });
}

export function useRoleId(name: string, mount = 'approle', enabled = true) {
  return useQuery({
    queryKey: ['approle', mount, 'role-id', name],
    queryFn: () => getRoleId(name, mount),
    enabled: enabled && !!name,
  });
}

export function useSecretIdAccessors(name: string, mount = 'approle', enabled = true) {
  return useQuery({
    queryKey: ['approle', mount, 'secret-ids', name],
    queryFn: () => listSecretIdAccessors(name, mount),
    enabled: enabled && !!name,
  });
}

export function useCreateAppRole(mount = 'approle') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, opts }: { name: string; opts: Parameters<typeof createAppRole>[1] }) =>
      createAppRole(name, opts, mount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approle', mount, 'list'] });
    },
  });
}

export function useDeleteAppRole(mount = 'approle') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteAppRole(name, mount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approle', mount, 'list'] });
    },
  });
}

export function useGenerateSecretId(mount = 'approle') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, opts }: { name: string; opts?: Parameters<typeof generateSecretId>[1] }) =>
      generateSecretId(name, opts || {}, mount),
    onSuccess: (_, { name }) => {
      qc.invalidateQueries({ queryKey: ['approle', mount, 'secret-ids', name] });
    },
  });
}

export function useDestroySecretId(mount = 'approle') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, accessor }: { name: string; accessor: string }) =>
      destroySecretId(name, accessor, mount),
    onSuccess: (_, { name }) => {
      qc.invalidateQueries({ queryKey: ['approle', mount, 'secret-ids', name] });
    },
  });
}
