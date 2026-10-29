import { existsSync } from "node:fs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Gives `next dev` the same D1 and R2 bindings the deployed Worker has, through
// wrangler's local emulation. `alchemy dev` writes wrangler.jsonc with the
// bindings of the current stage; without it (plain `next dev`, CI, Playwright)
// the checked-in local-only wrangler.local.jsonc describes them. Both persist
// to .wrangler/state/v3, which is where the db:*:local scripts write too.
// OpenNext itself makes this a no-op outside `next dev`.
initOpenNextCloudflareForDev({
	configPath: existsSync("wrangler.jsonc")
		? "wrangler.jsonc"
		: "wrangler.local.jsonc",
});

const nextConfig: NextConfig = {
	poweredByHeader: false,
	// AGENTS.md already carries the Next.js 16 rule; keep `next dev` from
	// appending its own copy to the file on every start.
	agentRules: false,
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{ key: "Referrer-Policy", value: "no-referrer" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
				],
			},
		];
	},
};

export default nextConfig;
