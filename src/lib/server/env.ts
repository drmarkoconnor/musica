type NetlifyRuntime = { env?: { get?: (key: string) => string | undefined } };

function netlifyRuntime() {
  return (globalThis as typeof globalThis & { Netlify?: NetlifyRuntime }).Netlify;
}

export function serverEnv(key: string) {
  return netlifyRuntime()?.env?.get?.(key) ?? process.env[key];
}

export function isNetlifyRuntime() {
  return typeof netlifyRuntime()?.env?.get === "function" || serverEnv("NETLIFY") === "true";
}

export function shouldUseNetlifyAudioStorage() {
  const configuredStorage = serverEnv("PRACTICE_LOOP_AUDIO_STORAGE");

  if (configuredStorage === "netlify-blobs") return true;
  if (configuredStorage === "local") return false;

  return isNetlifyRuntime();
}
