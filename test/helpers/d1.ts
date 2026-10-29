import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { type Bindings, setBindingsForTests } from "@/lib/cloudflare";

/**
 * A D1Database stand-in on Node's built-in SQLite, running the real
 * migrations from db/migrations. Tests exercise the same SQL that production
 * runs instead of a mock that agrees with whatever the code under test says.
 */
export function createTestD1(): D1Database {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec("pragma foreign_keys = on;");
	const dir = join(process.cwd(), "db", "migrations");
	for (const file of readdirSync(dir).sort()) {
		if (file.endsWith(".sql"))
			sqlite.exec(readFileSync(join(dir, file), "utf8"));
	}

	function statement(sql: string, params: unknown[] = []) {
		const prepared = sqlite.prepare(sql);
		const bound = params.map((value) =>
			value instanceof ArrayBuffer ? new Uint8Array(value) : value,
		) as Parameters<typeof prepared.all>;
		const returnsRows =
			/^\s*(select|with|pragma)/i.test(sql) || /returning/i.test(sql);
		return {
			bind: (...next: unknown[]) => statement(sql, next),
			async all<T>() {
				if (!returnsRows) {
					prepared.run(...bound);
					return { results: [] as T[], success: true, meta: {} };
				}
				return {
					results: prepared.all(...bound) as T[],
					success: true,
					meta: {},
				};
			},
			async first<T>(column?: string) {
				const row = prepared.get(...bound) as
					| Record<string, unknown>
					| undefined;
				if (!row) return null;
				return (column ? row[column] : row) as T;
			},
			async run() {
				const info = prepared.run(...bound);
				return {
					results: [],
					success: true,
					meta: { changes: Number(info.changes) },
				};
			},
			async raw() {
				return prepared
					.all(...bound)
					.map((row: unknown) => Object.values(row as object));
			},
		};
	}

	return {
		prepare: (sql: string) => statement(sql),
		async batch(statements: { run(): Promise<unknown> }[]) {
			sqlite.exec("begin");
			try {
				const results = [];
				for (const item of statements) results.push(await item.run());
				sqlite.exec("commit");
				return results;
			} catch (error) {
				sqlite.exec("rollback");
				throw error;
			}
		},
		async exec(sql: string) {
			sqlite.exec(sql);
			return { count: 0, duration: 0 };
		},
		dump: async () => new ArrayBuffer(0),
		withSession: () => {
			throw new Error("sessions are not supported in tests");
		},
	} as unknown as D1Database;
}

/** An in-memory R2Bucket with the four operations lib/storage uses. */
export function createTestBucket(): R2Bucket & {
	objects: Map<string, Uint8Array>;
} {
	const objects = new Map<string, Uint8Array>();
	const bucket = {
		objects,
		async put(
			key: string,
			value: ArrayBuffer | Uint8Array | string | ReadableStream,
		) {
			let bytes: Uint8Array;
			if (typeof value === "string") bytes = new TextEncoder().encode(value);
			else if (value instanceof Uint8Array) bytes = value;
			else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
			else bytes = new Uint8Array(await new Response(value).arrayBuffer());
			objects.set(key, bytes);
			return { key, size: bytes.byteLength };
		},
		async get(key: string) {
			const bytes = objects.get(key);
			if (!bytes) return null;
			return {
				key,
				size: bytes.byteLength,
				body: new Blob([bytes as BlobPart]).stream(),
				httpMetadata: { contentType: "image/jpeg" },
				httpEtag: `"${key}"`,
				arrayBuffer: async () => bytes.slice().buffer,
				blob: async () => new Blob([bytes as BlobPart], { type: "image/jpeg" }),
				writeHttpMetadata: () => {},
			};
		},
		async head(key: string) {
			const bytes = objects.get(key);
			return bytes ? { key, size: bytes.byteLength } : null;
		},
		async delete(keys: string | string[]) {
			for (const key of Array.isArray(keys) ? keys : [keys])
				objects.delete(key);
		},
		async list(options?: { prefix?: string }) {
			const prefix = options?.prefix ?? "";
			return {
				objects: [...objects.entries()]
					.filter(([key]) => key.startsWith(prefix))
					.map(([key, bytes]) => ({ key, size: bytes.byteLength })),
				truncated: false,
			};
		},
	};
	return bucket as unknown as R2Bucket & { objects: Map<string, Uint8Array> };
}

export function installTestBindings(extra: Record<string, unknown> = {}) {
	const DB = createTestD1();
	const GALLERY = createTestBucket();
	const value = { DB, GALLERY, ...extra } as Bindings;
	setBindingsForTests(value);
	return { DB, GALLERY };
}
