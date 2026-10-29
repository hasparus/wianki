import { createHash, timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();

/** Constant-time comparison of two shared secrets of any length. */
export function secretMatches(candidate: string, expected: string) {
	const candidateDigest = createHash("sha256").update(candidate).digest();
	const expectedDigest = createHash("sha256").update(expected).digest();
	return timingSafeEqual(candidateDigest, expectedDigest);
}

export function sha256Hex(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

function toBase64Url(bytes: Uint8Array) {
	return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const bytes = Buffer.from(value, "base64url");
	return new Uint8Array(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
	);
}

const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(
	passphrase: string,
	salt: Uint8Array<ArrayBuffer>,
	iterations: number,
) {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(passphrase.normalize("NFKC")),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", salt, iterations },
		key,
		256,
	);
	return new Uint8Array(bits);
}

/**
 * Guest and admin passphrases are typed by people, so they are stored as
 * PBKDF2-SHA256 hashes: `pbkdf2$<iterations>$<salt>$<hash>`, base64url.
 * WebCrypto only, so the same code runs in Node, in tests and on Workers.
 */
export async function hashPassphrase(passphrase: string) {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await pbkdf2(passphrase, salt, PBKDF2_ITERATIONS);
	return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassphrase(
	candidate: string,
	stored: string | null | undefined,
) {
	if (!stored) return false;
	const [scheme, iterations, salt, hash] = stored.split("$");
	if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false;
	const derived = await pbkdf2(
		candidate,
		fromBase64Url(salt),
		Number(iterations),
	);
	const expected = fromBase64Url(hash);
	if (derived.byteLength !== expected.byteLength) return false;
	return timingSafeEqual(derived, expected);
}

/** URL-safe random token with `bytes` bytes of entropy. */
export function randomToken(bytes = 32) {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}
