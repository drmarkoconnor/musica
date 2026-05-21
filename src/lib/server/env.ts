export function serverEnv(key: string) {
  return (process.env as Record<string, string | undefined>)[key];
}
