import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"cloudflare:workers": fileURLToPath(
				new URL("./test/stubs/cloudflare-workers.ts", import.meta.url),
			),
		},
	},
	test: {
		environment: "node",
		include: ["test/**/*.test.ts"],
		server: {
			// partyserver imports `cloudflare:workers`; inlining lets the alias
			// above swap in the stub instead of Node's loader refusing the scheme.
			deps: { inline: ["partyserver"] },
		},
	},
});
