import { jwtVerify, SignJWT } from "jose";
import { serverEnv } from "@/lib/env";

const encoder = new TextEncoder();
const audience = "wedding-archive";

export type ArchiveOperation = "upload" | "delete" | "reconcile";

export type ArchiveClaims = {
	photoId: string;
	operation: ArchiveOperation;
	filename?: string;
	contentType?: string;
	size?: number;
	archiveKey?: string;
};

export type ArchiveReceipt = {
	photoId: string;
	archiveKey: string;
	size: number;
};

function key() {
	return encoder.encode(serverEnv().ARCHIVE_TOKEN_SECRET);
}

export function createArchiveToken(claims: ArchiveClaims) {
	return new SignJWT({ ...claims })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience(audience)
		.setExpirationTime("10m")
		.sign(key());
}

export async function verifyArchiveReceipt(token: string) {
	const { payload } = await jwtVerify(token, key(), {
		algorithms: ["HS256"],
		audience,
	});
	if (
		payload.kind !== "receipt" ||
		typeof payload.photoId !== "string" ||
		typeof payload.archiveKey !== "string" ||
		typeof payload.size !== "number"
	) {
		throw new Error("Nieprawidłowe potwierdzenie archiwizacji.");
	}
	return {
		photoId: payload.photoId,
		archiveKey: payload.archiveKey,
		size: payload.size,
	} satisfies ArchiveReceipt;
}
