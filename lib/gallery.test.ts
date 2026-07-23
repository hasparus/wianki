import { describe, expect, it } from "vitest";
import { decodeGalleryCursor, encodeGalleryCursor } from "./gallery";

describe("gallery cursor", () => {
  it("round-trips a stable timestamp and UUID pair", () => {
    const value = {
      createdAt: "2026-07-23T12:00:00.123456Z",
      id: "123e4567-e89b-12d3-a456-426614174000",
    };
    expect(decodeGalleryCursor(encodeGalleryCursor(value))).toEqual(value);
  });

  it("rejects malformed cursors", () => {
    expect(decodeGalleryCursor("not-a-cursor")).toBeNull();
    expect(
      decodeGalleryCursor(
        Buffer.from(JSON.stringify({ createdAt: "yesterday", id: "no" })).toString(
          "base64url",
        ),
      ),
    ).toBeNull();
  });
});
