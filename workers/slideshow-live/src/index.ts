import {
	type Connection,
	routePartykitRequest,
	Server,
	type WSMessage,
} from "partyserver";
import {
	isBrowserOriginAllowed,
	parseClientMessage,
	RateLimiter,
	type ServerMessage,
	verifyLiveToken,
} from "./protocol";

export interface Env {
	SlideshowParty: DurableObjectNamespace<SlideshowParty>;
	ALLOWED_ORIGIN: string;
	LIVE_TOKEN_SECRET: string;
}

/**
 * One room per wedding. Everything here is ephemeral by design: reactions and
 * comments are broadcast to whoever is watching right now and never stored.
 */
export class SlideshowParty extends Server<Env> {
	static options = { hibernate: false };

	private readonly limiters = new Map<string, RateLimiter>();

	onConnect() {
		this.broadcastPresence();
	}

	onClose(connection: Connection) {
		this.limiters.delete(connection.id);
		this.broadcastPresence();
	}

	onError(connection: Connection) {
		this.limiters.delete(connection.id);
		this.broadcastPresence();
	}

	onMessage(connection: Connection, raw: WSMessage) {
		const message = parseClientMessage(raw);
		if (!message) return;
		let limiter = this.limiters.get(connection.id);
		if (!limiter) {
			limiter = new RateLimiter();
			this.limiters.set(connection.id, limiter);
		}
		if (!limiter.allow(message.type)) {
			this.send(connection, { type: "throttled", kind: message.type });
			return;
		}
		this.broadcast(
			JSON.stringify({ ...message, id: crypto.randomUUID() } as ServerMessage),
		);
	}

	onRequest() {
		return new Response("Nie znaleziono.", { status: 404 });
	}

	private send(connection: Connection, message: ServerMessage) {
		connection.send(JSON.stringify(message));
	}

	private broadcastPresence() {
		const viewers = [...this.getConnections()].length;
		this.broadcast(JSON.stringify({ type: "presence", viewers }));
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const response = await routePartykitRequest(request, env, {
			onBeforeConnect: async (req) => {
				if (
					!isBrowserOriginAllowed(req.headers.get("Origin"), env.ALLOWED_ORIGIN)
				) {
					return new Response("Niedozwolone źródło.", { status: 403 });
				}
				const token = new URL(req.url).searchParams.get("token");
				const role = await verifyLiveToken(token, env.LIVE_TOKEN_SECRET);
				if (!role) return new Response("Brak dostępu.", { status: 401 });
			},
		});
		return response ?? new Response("Nie znaleziono.", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
