import {
	type Connection,
	type ConnectionContext,
	routePartykitRequest,
	Server,
	type WSMessage,
} from "partyserver";
import {
	applyControl,
	IDLE_SHOW_STATE,
	parseClientMessage,
	RateLimiter,
	type ServerMessage,
	type ShowState,
	type SlideshowLiveRole,
	verifyLiveToken,
} from "../../../lib/slideshow-protocol";

export interface Env {
	SlideshowParty: DurableObjectNamespace<SlideshowParty>;
	ALLOWED_ORIGIN: string;
	LIVE_TOKEN_SECRET: string;
}

type ConnectionState = { role: SlideshowLiveRole };

function showMessage(state: ShowState): ServerMessage {
	return { type: "show", ...state };
}

/**
 * One room per wedding. Reactions and comments are ephemeral by design:
 * broadcast to whoever is watching right now and never stored. The show
 * state (which slide the presenter is on) is authoritative here, but its
 * source of truth is the presenter's device — if this object restarts, the
 * presenter's client re-claims the show on reconnect.
 */
export class SlideshowParty extends Server<Env> {
	static options = { hibernate: false };

	private readonly limiters = new Map<string, RateLimiter>();
	private show: ShowState = { ...IDLE_SHOW_STATE };

	async onConnect(
		connection: Connection<ConnectionState>,
		ctx: ConnectionContext,
	) {
		// The worker-level onBeforeConnect already rejected bad tokens; verify
		// again here to bind the role to the connection (defense in depth).
		const token = new URL(ctx.request.url).searchParams.get("token");
		const role = await verifyLiveToken(token, this.env.LIVE_TOKEN_SECRET);
		if (!role) {
			connection.close(4401, "Brak dostępu.");
			return;
		}
		connection.setState({ role });
		connection.send(JSON.stringify(showMessage(this.show)));
		this.broadcastPresence();
	}

	onClose(connection: Connection) {
		this.dropConnection(connection);
	}

	onError(connection: Connection) {
		this.dropConnection(connection);
	}

	onMessage(connection: Connection<ConnectionState>, raw: WSMessage) {
		const message = parseClientMessage(raw);
		if (!message) return;
		let limiter = this.limiters.get(connection.id);
		if (!limiter) {
			limiter = new RateLimiter();
			this.limiters.set(connection.id, limiter);
		}
		const kind = message.type === "control" ? "control" : message.type;
		if (!limiter.allow(kind)) return;
		if (message.type === "control") {
			const role = connection.state?.role ?? "guest";
			const next = applyControl(this.show, message, connection.id, role);
			if (!next) return;
			this.show = next;
			this.broadcast(JSON.stringify(showMessage(next)));
			return;
		}
		this.broadcast(
			JSON.stringify({ ...message, id: crypto.randomUUID() } as ServerMessage),
		);
	}

	onRequest() {
		return new Response("Nie znaleziono.", { status: 404 });
	}

	private dropConnection(connection: Connection) {
		this.limiters.delete(connection.id);
		if (this.show.presenterId === connection.id) {
			// Tempo is room configuration, not presenter state: any admin may set
			// it without steering, and it is what the couple saved. Losing the
			// presenter ends the live show, it does not retime the evening.
			this.show = { ...IDLE_SHOW_STATE, slideSeconds: this.show.slideSeconds };
			this.broadcast(JSON.stringify(showMessage(this.show)));
		}
		this.broadcastPresence();
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
				if (req.headers.get("Origin") !== env.ALLOWED_ORIGIN) {
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
