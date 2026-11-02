/**
 * Just enough of `cloudflare:workers` for partyserver to load under Node:
 * the tests exercise the routing and authorization layer, never a real
 * Durable Object.
 */
export class DurableObject<Env = unknown> {
	constructor(
		readonly ctx: unknown,
		readonly env: Env,
	) {}
}

export const env = {};
