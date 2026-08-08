"use client";

import PartySocket from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	IDLE_SHOW,
	type ShowStatePayload,
	type SlideshowLiveAccess,
	type SlideshowLiveRole,
} from "@/lib/slideshow-live";

export type SlideshowBubble =
	| {
			id: string;
			kind: "reaction";
			emoji: string;
			leftPercent: number;
			durationMs: number;
			sizeVmin: number;
	  }
	| {
			id: string;
			kind: "comment";
			text: string;
			topPercent: number;
			durationMs: number;
	  };

export type LiveStatus = "connecting" | "on" | "off";

export type SlideshowControl =
	| { action: "steer" }
	| { action: "tempo"; slideSeconds: number }
	| { action: "goto"; index: number; slideId: string | null; playing: boolean };

const MAX_BUBBLES = 60;
// Lanes start below the header pills so drifting comments never collide
// with the chrome on small screens.
const COMMENT_LANES = [13, 20, 27, 34, 41];

type ServerMessage =
	| { type: "presence"; viewers: number }
	| { type: "reaction"; id: string; emoji: string }
	| { type: "comment"; id: string; text: string }
	| ({ type: "show" } & ShowStatePayload);

export function useSlideshowLive() {
	const [status, setStatus] = useState<LiveStatus>("connecting");
	const [role, setRole] = useState<SlideshowLiveRole | null>(null);
	const [viewers, setViewers] = useState(0);
	const [show, setShow] = useState<ShowStatePayload>(IDLE_SHOW);
	const [socketId, setSocketId] = useState<string | null>(null);
	const [connectionEpoch, setConnectionEpoch] = useState(0);
	const [bubbles, setBubbles] = useState<SlideshowBubble[]>([]);
	const [lastComment, setLastComment] = useState("");
	const socketRef = useRef<PartySocket | null>(null);
	const laneRef = useRef(0);

	const pushBubble = useCallback((bubble: SlideshowBubble) => {
		setBubbles((current) => [...current.slice(1 - MAX_BUBBLES), bubble]);
	}, []);

	const dismissBubble = useCallback((id: string) => {
		setBubbles((current) => current.filter((bubble) => bubble.id !== id));
	}, []);

	useEffect(() => {
		let disposed = false;

		function handleMessage(raw: string) {
			let message: ServerMessage;
			try {
				message = JSON.parse(raw) as ServerMessage;
			} catch {
				return;
			}
			if (message.type === "presence") {
				setViewers(message.viewers);
				return;
			}
			if (message.type === "show") {
				setShow({
					live: message.live,
					index: message.index,
					slideId: message.slideId,
					playing: message.playing,
					presenterId: message.presenterId,
					slideSeconds: message.slideSeconds,
				});
				return;
			}
			if (message.type === "reaction") {
				pushBubble({
					id: message.id,
					kind: "reaction",
					emoji: message.emoji,
					leftPercent: 6 + Math.random() * 82,
					durationMs: 3600 + Math.random() * 2000,
					sizeVmin: 6.5 + Math.random() * 4,
				});
				return;
			}
			if (message.type === "comment") {
				laneRef.current = (laneRef.current + 1) % COMMENT_LANES.length;
				pushBubble({
					id: message.id,
					kind: "comment",
					text: message.text,
					topPercent: COMMENT_LANES[laneRef.current],
					durationMs: 6000 + message.text.length * 35,
				});
				setLastComment(message.text);
			}
		}

		async function connect() {
			try {
				const response = await fetch("/api/slideshow/live", {
					cache: "no-store",
				});
				if (!response.ok) throw new Error("live access failed");
				const body = (await response.json()) as {
					live: SlideshowLiveAccess | null;
				};
				if (disposed) return;
				if (!body.live) {
					setStatus("off");
					return;
				}
				setRole(body.live.role);
				const socket = new PartySocket({
					host: body.live.host,
					party: body.live.party,
					room: body.live.room,
					query: { token: body.live.token },
				});
				socketRef.current = socket;
				setSocketId(socket.id);
				socket.addEventListener("open", () => {
					setStatus("on");
					setConnectionEpoch((epoch) => epoch + 1);
				});
				socket.addEventListener("message", (event) => {
					if (typeof event.data === "string") handleMessage(event.data);
				});
			} catch {
				if (!disposed) setStatus("off");
			}
		}

		connect();
		return () => {
			disposed = true;
			socketRef.current?.close();
			socketRef.current = null;
		};
	}, [pushBubble]);

	const sendReaction = useCallback((emoji: string) => {
		socketRef.current?.send(JSON.stringify({ type: "reaction", emoji }));
	}, []);

	const sendComment = useCallback((text: string) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		socketRef.current?.send(JSON.stringify({ type: "comment", text: trimmed }));
	}, []);

	const sendControl = useCallback((control: SlideshowControl) => {
		socketRef.current?.send(JSON.stringify({ type: "control", ...control }));
	}, []);

	const isPresenter =
		socketId !== null &&
		show.presenterId !== null &&
		show.presenterId === socketId;

	return {
		status,
		role,
		viewers,
		show,
		isPresenter,
		connectionEpoch,
		bubbles,
		lastComment,
		dismissBubble,
		sendReaction,
		sendComment,
		sendControl,
	};
}
