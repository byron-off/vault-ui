export type Application = {
  app_name: string;
  description: string;
  env: 'prod' | 'staging' | 'dev';
  kv_path: string;
  policy_name: string;
  approle_name: string;
  role_id: string;
  created_at: string;
  created_by_accessor: string;
  tags?: string[];
};
