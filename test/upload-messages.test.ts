import { afterEach, describe, expect, it, vi } from "vitest";
import {
	completedUploadMessage,
	uploadCompleteInstruction,
} from "@/components/upload/messages";

describe("upload completion message", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps the rotating success copy and invites further uploads", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		expect(completedUploadMessage()).toBe(
			`Niezły z Ciebie fotograf! 📸 ${uploadCompleteInstruction}`,
		);
		expect(uploadCompleteInstruction).not.toContain("zamknąć tę stronę");
		expect(uploadCompleteInstruction).toContain("dodawaj kolejne");
	});
});
