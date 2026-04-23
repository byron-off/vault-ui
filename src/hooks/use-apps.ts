'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listApplications,
  getApplication,
  saveApplication,
  deleteApplicationMetadata,
} from '@/lib/vault/api/apps';
import type { Application } from '@/types/app';

export function useApplications() {
  return useQuery({
    queryKey: ['apps', 'list'],
    queryFn: listApplications,
  });
}

export function useApplication(name: string, enabled = true) {
  return useQuery({
    queryKey: ['apps', 'detail', name],
    queryFn: () => getApplication(name),
    enabled: enabled && !!name,
  });
}

export function useSaveApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (app: Application) => saveApplication(app),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps', 'list'] });
    },
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteApplicationMetadata(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps', 'list'] });
    },
  });
}
