import path from "node:path";

/**
 * Fills process.env from the repo's local secret files and returns the
 * required variables, having exited if any is missing — so callers get plain
 * strings instead of `string | undefined`. Already-set variables always win,
 * which is what process.loadEnvFile does natively.
 */
export function loadLocalEnv<K extends string>(
	required: readonly K[],
): Record<K, string> {
	const root = path.resolve(import.meta.dirname, "..", "..");
	for (const name of [".secrets.deploy", ".env.local"]) {
		try {
			process.loadEnvFile(path.join(root, name));
		} catch {}
	}
	const missing = required.filter((key) => !process.env[key]);
	if (missing.length) {
		console.error(`missing env: ${missing.join(", ")}`);
		process.exit(2);
	}
	return Object.fromEntries(
		required.map((key) => [key, process.env[key] as string]),
	) as Record<K, string>;
}

export function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
