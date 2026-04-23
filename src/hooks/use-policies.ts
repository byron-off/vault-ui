'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAclPolicies,
  getAclPolicy,
  writeAclPolicy,
  deleteAclPolicy,
  listPasswordPolicies,
  getPasswordPolicy,
  writePasswordPolicy,
  deletePasswordPolicy,
  generatePassword,
} from '@/lib/vault/api/policies';

export function useAclPolicies() {
  return useQuery({
    queryKey: ['policies', 'acl', 'list'],
    queryFn: listAclPolicies,
  });
}

export function useAclPolicy(name: string, enabled = true) {
  return useQuery({
    queryKey: ['policies', 'acl', name],
    queryFn: () => getAclPolicy(name),
    enabled: enabled && !!name,
  });
}

export function useWriteAclPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, policy }: { name: string; policy: string }) => writeAclPolicy(name, policy),
    onSuccess: (_, { name }) => {
      qc.invalidateQueries({ queryKey: ['policies', 'acl', 'list'] });
      qc.invalidateQueries({ queryKey: ['policies', 'acl', name] });
    },
  });
}

export function useDeleteAclPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteAclPolicy(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies', 'acl', 'list'] });
    },
  });
}

export function usePasswordPolicies() {
  return useQuery({
    queryKey: ['policies', 'password', 'list'],
    queryFn: listPasswordPolicies,
  });
}

export function usePasswordPolicy(name: string, enabled = true) {
  return useQuery({
    queryKey: ['policies', 'password', name],
    queryFn: () => getPasswordPolicy(name),
    enabled: enabled && !!name,
  });
}

export function useWritePasswordPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, policy }: { name: string; policy: string }) =>
      writePasswordPolicy(name, policy),
    onSuccess: (_, { name }) => {
      qc.invalidateQueries({ queryKey: ['policies', 'password', 'list'] });
      qc.invalidateQueries({ queryKey: ['policies', 'password', name] });
    },
  });
}

export function useDeletePasswordPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deletePasswordPolicy(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies', 'password', 'list'] });
    },
  });
}

export function useGeneratePassword() {
  return useMutation({
    mutationFn: (name: string) => generatePassword(name),
  });
}
