export function serverEnv(key: string) {
  return (process.env as Record<string, string | undefined>)[key];
}

export function shouldUseNetlifyAudioStorage() {
  const configuredStorage = serverEnv("PRACTICE_LOOP_AUDIO_STORAGE");

  if (configuredStorage === "netlify-blobs") return true;
  if (configuredStorage === "local") return false;

  return serverEnv("NETLIFY") === "true";
}
