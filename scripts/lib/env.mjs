import path from "node:path";

/**
 * Fills process.env from the repo's local secret files, then fails fast on
 * anything still missing. Already-set variables always win, which is what
 * process.loadEnvFile does natively.
 */
export function loadLocalEnv(required) {
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
}
