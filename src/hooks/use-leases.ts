'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listLeasePrefixes, lookupLease, renewLease, revokeLease,
  revokePrefix, revokeForce, tidyLeases,
} from '@/lib/vault/api/leases';

export function useLeasePrefixes(prefix = '', enabled = true) {
  return useQuery({
    queryKey: ['leases', 'prefixes', prefix],
    queryFn: () => listLeasePrefixes(prefix),
    enabled,
  });
}

export function useLookupLease() {
  return useMutation({ mutationFn: lookupLease });
}

export function useRenewLease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lease_id, increment }: { lease_id: string; increment?: number }) =>
      renewLease(lease_id, increment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leases'] }),
  });
}

export function useRevokeLease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeLease,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leases'] }),
  });
}

export function useRevokePrefix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokePrefix,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leases'] }),
  });
}

export function useRevokeForce() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeForce,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leases'] }),
  });
}

export function useTidyLeases() {
  return useMutation({ mutationFn: tidyLeases });
}
