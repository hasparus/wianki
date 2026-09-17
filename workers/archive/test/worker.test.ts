import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { sanitizeObjectName } from "../src/backend";
import worker, { type Env, selectBackend } from "../src/index";
import { archiveKeyPrefix, buildArchiveKey } from "../src/r2";

const photoId = "11111111-1111-4111-8111-111111111111";

describe("Archive boundary", () => {
	it("sanitizes unsafe object names", () => {
		expect(sanitizeObjectName("abc/..\\photo\u0000.jpg")).toBe(
			"abc-..-photo-.jpg",
		);
	});

	it("keeps every object under a per-photo prefix so reconcile is a lookup", () => {
		const key = buildArchiveKey(photoId, "wesele.jpg");
		expect(key.startsWith(archiveKeyPrefix(photoId))).toBe(true);
		expect(key).toBe(`originals/${photoId}__wesele.jpg`);
	});

	it("keeps a traversing filename inside its own photo prefix", () => {
		const key = buildArchiveKey(photoId, "../../etc/passwd");
		expect(key.startsWith(archiveKeyPrefix(photoId))).toBe(true);
		expect(key).not.toContain("/etc/");
	});
});

function bucketSpy(deleted: string[] = []) {
	return {
		delete: async (key: string) => {
			deleted.push(key);
		},
	} as unknown as R2Bucket;
}

function env(overrides: Partial<Env>): Env {
	return {
		ALLOWED_ORIGIN: "https://wedding.pawel.space",
		ARCHIVE_TOKEN_SECRET: "0123456789abcdef0123456789abcdef",
		GOOGLE_OAUTH_CLIENT_ID: "id",
		GOOGLE_OAUTH_CLIENT_SECRET: "secret",
		GOOGLE_OAUTH_REFRESH_TOKEN: "refresh",
		GOOGLE_DRIVE_FOLDER_ID: "folder",
		...overrides,
	};
}

describe("backend selection", () => {
	it("defaults to R2, which needs its bucket binding", () => {
		expect(() =>
			selectBackend(env({ ARCHIVE_BUCKET: bucketSpy() })),
		).not.toThrow();
		expect(() => selectBackend(env({}))).toThrow(/ARCHIVE_BUCKET/);
	});

	it("selects Drive without needing a bucket", () => {
		expect(() =>
			selectBackend(env({ ARCHIVE_BACKEND: "drive" })),
		).not.toThrow();
	});

	it("rejects an unknown backend instead of archiving somewhere unexpected", () => {
		expect(() => selectBackend(env({ ARCHIVE_BACKEND: "dropbox" }))).toThrow(
			/Nieznane archiwum/,
		);
	});
});

describe("R2 removal", () => {
	it("refuses a key that belongs to another photo", async () => {
		const backend = selectBackend(env({ ARCHIVE_BUCKET: bucketSpy() }));
		await expect(
			backend.remove(photoId, "originals/22222222__stolen.jpg"),
		).rejects.toThrow(/nie należy/);
	});

	it("deletes a key under the photo's own prefix", async () => {
		const deleted: string[] = [];
		const backend = selectBackend(env({ ARCHIVE_BUCKET: bucketSpy(deleted) }));
		const key = buildArchiveKey(photoId, "wesele.jpg");
		await backend.remove(photoId, key);
		expect(deleted).toEqual([key]);
	});
});

const secret = "0123456789abcdef0123456789abcdef";
const origin = "https://wedding.pawel.space";

async function operationToken(claims: Record<string, unknown>) {
	return new SignJWT(claims)
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience("wedding-archive")
		.setExpirationTime("10m")
		.sign(new TextEncoder().encode(secret));
}

function call(
	method: string,
	token: string | null,
	id = photoId,
	init: RequestInit = {},
) {
	return worker.fetch(
		new Request(`https://archive.example/v1/archive/${id}`, {
			method,
			headers: {
				Origin: origin,
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...((init.headers as Record<string, string>) ?? {}),
			},
			...init,
		}),
		env({ ARCHIVE_BUCKET: bucketSpy() }),
	);
}

describe("HTTP boundary", () => {
	it("rejects a foreign origin before looking at the token", async () => {
		const response = await worker.fetch(
			new Request(`https://archive.example/v1/archive/${photoId}`, {
				method: "GET",
				headers: { Origin: "https://evil.example" },
			}),
			env({ ARCHIVE_BUCKET: bucketSpy() }),
		);
		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("answers 401, not 400, without a token", async () => {
		expect((await call("GET", null)).status).toBe(401);
	});

	it("refuses a token minted for another photo", async () => {
		const token = await operationToken({
			photoId: "22222222-2222-4222-8222-222222222222",
			operation: "reconcile",
		});
		expect((await call("GET", token)).status).toBe(403);
	});

	it("refuses a token whose operation does not match the method", async () => {
		const token = await operationToken({ photoId, operation: "reconcile" });
		expect((await call("DELETE", token)).status).toBe(401);
	});

	it("refuses an oversized original before touching the archive", async () => {
		const token = await operationToken({
			photoId,
			operation: "upload",
			filename: "big.jpg",
			contentType: "image/jpeg",
			size: 26 * 1024 * 1024,
		});
		const response = await call("PUT", token, photoId, { body: "x" });
		expect(response.status).toBe(400);
	});

	it("keeps a misconfigured deployment quiet behind a valid token", async () => {
		const token = await operationToken({ photoId, operation: "reconcile" });
		const response = await worker.fetch(
			new Request(`https://archive.example/v1/archive/${photoId}`, {
				method: "GET",
				headers: { Origin: origin, Authorization: `Bearer ${token}` },
			}),
			env({}),
		);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "Archiwum jest niedostępne.",
		});
	});
});
