'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listEntities, getEntityByName, createEntity, updateEntity, deleteEntity,
  listGroups, getGroupById, createGroup, updateGroup, deleteGroup,
} from '@/lib/vault/api/identity';

export function useEntities() {
  return useQuery({ queryKey: ['identity', 'entities'], queryFn: listEntities });
}

export function useEntity(name: string, enabled = true) {
  return useQuery({
    queryKey: ['identity', 'entity', 'name', name],
    queryFn: () => getEntityByName(name),
    enabled: enabled && !!name,
  });
}

export function useCreateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEntity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'entities'] }),
  });
}

export function useUpdateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, opts }: { id: string; opts: Parameters<typeof updateEntity>[1] }) =>
      updateEntity(id, opts),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'entities'] }),
  });
}

export function useDeleteEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteEntity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'entities'] }),
  });
}

export function useGroups() {
  return useQuery({ queryKey: ['identity', 'groups', 'list'], queryFn: listGroups });
}

export function useGroup(id: string, enabled = true) {
  return useQuery({
    queryKey: ['identity', 'groups', 'detail', id],
    queryFn: () => getGroupById(id),
    enabled: enabled && !!id,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'groups'] }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, opts }: { id: string; opts: Parameters<typeof updateGroup>[1] }) =>
      updateGroup(id, opts),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'groups'] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'groups'] }),
  });
}
