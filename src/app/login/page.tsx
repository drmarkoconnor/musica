import { LockKeyhole } from "lucide-react";
import { isAppAuthEnabled, safeRedirectPath } from "@/lib/app-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = safeRedirectPath(
    typeof params.next === "string" ? params.next : "/",
  );
  const hasError = params.error === "1";
  const authEnabled = isAppAuthEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-950 text-white">
            <LockKeyhole aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
              Private app
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-stone-950">
              Practice Loop
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-stone-600">
          Enter the private app password before opening lesson recordings,
          transcripts, lead sheets, and practice notes.
        </p>

        {!authEnabled ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
            App password protection is not configured. Set
            {" "}
            <code>PRACTICE_LOOP_APP_PASSWORD</code>
            {" "}
            before storing real conversations.
          </p>
        ) : null}

        <form action="/api/auth/login" className="mt-5 space-y-4" method="post">
          <input name="next" type="hidden" value={nextPath} />
          <label className="block">
            <span className="text-sm font-medium text-stone-800">Password</span>
            <input
              autoComplete="current-password"
              autoFocus
              className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
              name="password"
              required={authEnabled}
              type="password"
            />
          </label>
          {hasError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Password not accepted.
            </p>
          ) : null}
          <button
            className="inline-flex w-full items-center justify-center rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
            type="submit"
          >
            Unlock
          </button>
        </form>
      </section>
    </main>
  );
}
