import { describe, expect, it, vi } from "vitest";
import { runWithConcurrency } from "@/components/upload/upload-queue";

function deferred() {
	let resolve = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("upload queue", () => {
	it("limits mixed fresh and archive-retry jobs to two originals in flight", async () => {
		const jobs = ["fresh", "archive_retry", "fresh", "archive_retry"];
		const gates = jobs.map(() => deferred());
		const started: number[] = [];
		let active = 0;
		let maximumActive = 0;

		const queued = runWithConcurrency(jobs, 2, async (_, index) => {
			started.push(index);
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			await gates[index].promise;
			active -= 1;
			return jobs[index];
		});

		await Promise.resolve();
		expect(started).toEqual([0, 1]);
		expect(maximumActive).toBe(2);

		gates[0].resolve();
		await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));

		gates[1].resolve();
		gates[2].resolve();
		await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3]));

		gates[3].resolve();
		await expect(queued).resolves.toEqual(jobs);
		expect(maximumActive).toBe(2);
	});
});
