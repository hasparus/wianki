import type { D1Database } from "@cloudflare/workers-types";
import { bindings } from "@/lib/cloudflare";

/**
 * Thin D1 helpers. Queries are written as plain SQL with positional
 * placeholders and explicit row types; there is no query builder to learn
 * and nothing between the SQL in lib/ and the SQL in db/migrations.
 */
export type SqlValue = string | number | null | ArrayBuffer;

export function db(): D1Database {
	return bindings().DB;
}

export async function all<Row>(
	sql: string,
	params: SqlValue[] = [],
): Promise<Row[]> {
	const result = await db()
		.prepare(sql)
		.bind(...params)
		.all<Row>();
	return result.results;
}

export async function first<Row>(
	sql: string,
	params: SqlValue[] = [],
): Promise<Row | null> {
	const row = await db()
		.prepare(sql)
		.bind(...params)
		.first<Row>();
	return row ?? null;
}

/** Runs a statement and returns how many rows it changed. */
export async function run(
	sql: string,
	params: SqlValue[] = [],
): Promise<number> {
	const result = await db()
		.prepare(sql)
		.bind(...params)
		.run();
	return result.meta.changes ?? 0;
}

/** Several statements in one round trip, applied atomically by D1. */
export async function batch(
	statements: { sql: string; params?: SqlValue[] }[],
): Promise<void> {
	if (statements.length === 0) return;
	const database = db();
	await database.batch(
		statements.map(({ sql, params = [] }) =>
			database.prepare(sql).bind(...params),
		),
	);
}

export function nowIso() {
	return new Date().toISOString();
}

/** Builds `?, ?, ?` for an IN list. */
export function placeholders(count: number) {
	return Array.from({ length: count }, () => "?").join(", ");
}
