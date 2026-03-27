/**
 * Typed environment variable access with validation.
 * Bun loads .env automatically — no dotenv needed.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function optionalEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}
