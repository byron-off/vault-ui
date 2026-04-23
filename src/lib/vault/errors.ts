export class VaultError extends Error {
  constructor(
    public status: number,
    public errors: string[],
    public warnings?: string[]
  ) {
    super(errors[0] || 'Unknown error');
    this.name = 'VaultError';
  }
}
