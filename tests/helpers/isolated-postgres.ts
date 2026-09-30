import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { neonConfig } from "@neondatabase/serverless";

const TEST_DATABASE_URL = "postgresql://test:test@isolated.invalid/practice_loop_test";
const migrationsDirectory = new URL("../../drizzle/", import.meta.url);

type SqlRequest = { query: string; params: unknown[] };
type InjectedFailure = { match: RegExp; when: "before" | "after"; message: string };

/**
 * Executes the application's real Neon HTTP/Drizzle queries against embedded
 * PostgreSQL. Only the transport is substituted: SQL, parameters, constraints,
 * conflict handling and Neon result parsing remain in use.
 *
 * PGlite serialises statements within one backend. These tests exercise retries
 * and interleaved requests, but cannot prove multi-connection lock scheduling.
 * API: https://pglite.dev/docs/api ; Neon adapter contract is also checked in the
 * installed @neondatabase/serverless processQueryResult implementation.
 */
export async function createIsolatedPostgres() {
  const postgres = await PGlite.create({ extensions: { pgcrypto } });
  const journal = JSON.parse(await readFile(new URL("meta/_journal.json", migrationsDirectory), "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  const migrationFiles: string[] = [];
  for (const entry of journal.entries) {
    const migration = new URL(`${entry.tag}.sql`, migrationsDirectory);
    await postgres.exec(await readFile(migration, "utf8"));
    migrationFiles.push(fileURLToPath(migration));
  }

  // Neon asks PostgreSQL for text-format fields and performs its own parsing.
  // Suppress PGlite parsing to avoid silently testing a different type contract.
  const { rows: databaseTypes } = await postgres.query<{ oid: number }>("select oid from pg_type");
  const rawParsers = Object.fromEntries(databaseTypes.map(({ oid }) => [oid, (value: string) => value]));
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalFetchFunction = neonConfig.fetchFunction;
  const originalFetch = globalThis.fetch;
  const queries: SqlRequest[] = [];
  let failure: InjectedFailure | undefined;

  process.env.DATABASE_URL = TEST_DATABASE_URL;
  globalThis.fetch = async () => { throw new Error("External network is forbidden in isolated database tests."); };

  async function execute(request: SqlRequest, connection: PGlite | Transaction = postgres) {
    assert.equal(typeof request.query, "string");
    assert.ok(Array.isArray(request.params));
    queries.push(request);
    const pendingFailure = failure?.match.test(request.query) ? failure : undefined;
    if (pendingFailure) failure = undefined;
    if (pendingFailure?.when === "before") throw new Error(pendingFailure.message);
    const result = await connection.query<unknown[]>(request.query, request.params, {
      rowMode: "array", parsers: rawParsers,
    });
    if (pendingFailure?.when === "after") throw new Error(pendingFailure.message);
    return {
      fields: result.fields,
      rows: result.rows,
      rowCount: result.affectedRows || result.rows.length,
      command: request.query.trim().split(/\s+/)[0].toUpperCase(),
    };
  }

  neonConfig.fetchFunction = async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Neon-Connection-String"), TEST_DATABASE_URL, "Only the sentinel test database is allowed");
    assert.equal(headers.get("Neon-Raw-Text-Output"), "true");
    assert.equal(headers.get("Neon-Array-Mode"), "true");
    const body = JSON.parse(String(init?.body)) as SqlRequest | { queries: SqlRequest[] };
    try {
      const result = "queries" in body
        ? { results: await postgres.transaction(async (transaction) => {
          const results = [];
          for (const request of body.queries) results.push(await execute(request, transaction));
          return results;
        }) }
        : await execute(body);
      return Response.json(result);
    } catch (error) {
      const detail = error as Error & { code?: string; constraint?: string; detail?: string; table?: string };
      return Response.json({
        message: detail.message, code: detail.code, constraint: detail.constraint,
        detail: detail.detail, table: detail.table,
      }, { status: 400 });
    }
  };

  return {
    postgres,
    queries,
    migrationFiles,
    failNextQuery(injectedFailure: InjectedFailure) { failure = injectedFailure; },
    async reset() {
      failure = undefined;
      queries.length = 0;
      const { rows } = await postgres.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'");
      const tables = rows.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`);
      if (tables.length) await postgres.exec(`truncate table ${tables.join(", ")} cascade`);
    },
    async close() {
      neonConfig.fetchFunction = originalFetchFunction;
      globalThis.fetch = originalFetch;
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      await postgres.close();
    },
  };
}

export type IsolatedPostgres = Awaited<ReturnType<typeof createIsolatedPostgres>>;
