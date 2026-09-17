import { describe, expect, it } from "vitest";
import { uploadCompleteInstruction } from "@/components/upload/messages";

describe("upload completion message", () => {
	/**
	 * One line, and only the part a guest cannot see for themselves. The
	 * thumbnails below it already show what arrived, and the picker beside it
	 * already offers another batch, so the message carries the one fact neither
	 * of them can: the photos are not in the gallery yet.
	 */
	it("states the delay and nothing the interface already shows", () => {
		expect(uploadCompleteInstruction).toBe(
			"Zdjęcia dotarły. W galerii będą za kilka minut.",
		);
		expect(uploadCompleteInstruction).not.toContain("zamknąć tę stronę");
		expect(uploadCompleteInstruction.length).toBeLessThan(80);
	});
});
