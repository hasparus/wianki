export async function runWithConcurrency<T, Result>(
	values: readonly T[],
	limit: number,
	run: (value: T, index: number) => Promise<Result>,
): Promise<Result[]> {
	const results = new Array<Result>(values.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < values.length) {
			const index = nextIndex++;
			results[index] = await run(values[index], index);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(limit, values.length) }, () => worker()),
	);
	return results;
}
