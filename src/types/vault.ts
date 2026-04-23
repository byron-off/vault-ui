export type TokenInfo = {
  accessor: string;
  policies: string[];
  ttl: number;
  renewable: boolean;
  display_name: string;
  entity_id: string;
  expire_time: string | null;
};

export type KVMetadata = {
  current_version: number;
  oldest_version: number;
  max_versions: number;
  cas_required: boolean;
  created_time: string;
  updated_time: string;
  custom_metadata: Record<string, string> | null;
  versions: Record<string, KVVersion>;
};

export type KVVersion = {
  version: number;
  created_time: string;
  deletion_time: string;
  destroyed: boolean;
};

export type KVSecret = {
  data: Record<string, string>;
  metadata: {
    version: number;
    created_time: string;
    deletion_time: string;
    destroyed: boolean;
  };
};

export type MountConfig = {
  path: string;
  type: string;
  description: string;
  accessor: string;
  local: boolean;
  seal_wrap: boolean;
  options: Record<string, string> | null;
  config: {
    default_lease_ttl: number;
    max_lease_ttl: number;
    force_no_cache: boolean;
  };
};

export type AuthMount = {
  path: string;
  type: string;
  description: string;
  accessor: string;
  local: boolean;
  config: {
    default_lease_ttl: number;
    max_lease_ttl: number;
    token_type: string;
  };
};

export type Policy = {
  name: string;
  rules: string;
};

export type AppRoleRole = {
  bind_secret_id: boolean;
  secret_id_bound_cidrs: string[];
  secret_id_num_uses: number;
  secret_id_ttl: string;
  token_bound_cidrs: string[];
  token_explicit_max_ttl: number;
  token_max_ttl: number;
  token_no_default_policy: boolean;
  token_num_uses: number;
  token_period: number;
  token_policies: string[];
  token_ttl: number;
  token_type: string;
};

export type SysHealth = {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
  replication_performance_mode: string;
  replication_dr_mode: string;
  server_time_utc: number;
  version: string;
  cluster_name: string;
  cluster_id: string;
};

export type SealStatus = {
  type: string;
  initialized: boolean;
  sealed: boolean;
  t: number;
  n: number;
  progress: number;
  nonce: string;
  version: string;
  build_date: string;
  migration: boolean;
  cluster_name: string;
  cluster_id: string;
};

export type HAStatus = {
  ha_enabled: boolean;
  is_self: boolean;
  leader_address: string;
  leader_cluster_address: string;
  performance_standby: boolean;
  performance_standby_last_remote_wal: number;
  raft_committed_index: number;
  raft_applied_index: number;
  nodes?: Array<{
    hostname: string;
    api_address: string;
    cluster_address: string;
    active_node: boolean;
    last_echo: string | null;
    upgrade_version: string;
  }>;
};

export type LeaseInfo = {
  id: string;
  issue_time: string;
  expire_time: string;
  last_renewal: string | null;
  renewable: boolean;
  ttl: number;
};

export type IdentityEntity = {
  id: string;
  name: string;
  aliases: Array<{
    id: string;
    mount_accessor: string;
    mount_type: string;
    name: string;
  }>;
  policies: string[];
  disabled: boolean;
  creation_time: string;
  last_update_time: string;
  metadata: Record<string, string> | null;
};

export type IdentityGroup = {
  id: string;
  name: string;
  type: string;
  policies: string[];
  member_entity_ids: string[];
  member_group_ids: string[];
  creation_time: string;
  last_update_time: string;
  metadata: Record<string, string> | null;
};
