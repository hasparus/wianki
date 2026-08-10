import { describe, expect, it } from "vitest";
import {
	decodeAdminCursor,
	encodeAdminCursor,
	isAdminPhotoActionable,
} from "./admin";

describe("admin photo cursor", () => {
	it("round-trips a stable timestamp and UUID pair", () => {
		const value = {
			createdAt: "2026-07-23T12:00:00.123456Z",
			id: "123e4567-e89b-12d3-a456-426614174000",
		};
		expect(decodeAdminCursor(encodeAdminCursor(value))).toEqual(value);
	});

	it("rejects malformed cursors", () => {
		expect(decodeAdminCursor("not-a-cursor")).toBeNull();
		expect(
			decodeAdminCursor(
				Buffer.from(
					JSON.stringify({ createdAt: "yesterday", id: "no" }),
				).toString("base64url"),
			),
		).toBeNull();
	});
});

describe("admin photo visibility", () => {
	it("hides terminal tombstones with no remaining actionable copy", () => {
		expect(
			isAdminPhotoActionable({
				hot_status: "deleted",
				archive_status: "trashed",
				archive_key: "originals/photo__x.jpg",
			}),
		).toBe(false);
		expect(
			isAdminPhotoActionable({
				hot_status: "deleted",
				archive_status: "failed",
				archive_key: null,
			}),
		).toBe(false);
	});

	it("keeps partial deletions that the admin can retry", () => {
		expect(
			isAdminPhotoActionable({
				hot_status: "deleted",
				archive_status: "deletion_error",
				archive_key: "originals/photo__x.jpg",
			}),
		).toBe(true);
		expect(
			isAdminPhotoActionable({
				hot_status: "failed",
				archive_status: "trashed",
				archive_key: "originals/photo__x.jpg",
			}),
		).toBe(true);
	});
});
