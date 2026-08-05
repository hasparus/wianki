"use client";

import PartySocket from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SlideshowLiveAccess } from "@/lib/slideshow-live";

export type SlideshowBubble =
	| {
			id: string;
			kind: "reaction";
			emoji: string;
			leftPercent: number;
			durationMs: number;
			sizeRem: number;
	  }
	| {
			id: string;
			kind: "comment";
			text: string;
			topPercent: number;
			durationMs: number;
	  };

export type LiveStatus = "connecting" | "on" | "off";

const MAX_BUBBLES = 60;
const COMMENT_LANES = [8, 16, 24, 32, 40];

type ServerMessage =
	| { type: "presence"; viewers: number }
	| { type: "reaction"; id: string; emoji: string }
	| { type: "comment"; id: string; text: string }
	| { type: "throttled"; kind: "reaction" | "comment" };

export function useSlideshowLive() {
	const [status, setStatus] = useState<LiveStatus>("connecting");
	const [viewers, setViewers] = useState(0);
	const [bubbles, setBubbles] = useState<SlideshowBubble[]>([]);
	const [lastComment, setLastComment] = useState("");
	const [throttled, setThrottled] = useState(false);
	const socketRef = useRef<PartySocket | null>(null);
	const laneRef = useRef(0);
	const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

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
			if (message.type === "reaction") {
				pushBubble({
					id: message.id,
					kind: "reaction",
					emoji: message.emoji,
					leftPercent: 6 + Math.random() * 82,
					durationMs: 5200 + Math.random() * 3000,
					sizeRem: 1.6 + Math.random(),
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
					durationMs: 9000 + message.text.length * 60,
				});
				setLastComment(message.text);
				return;
			}
			if (message.type === "throttled") {
				setThrottled(true);
				clearTimeout(throttleTimerRef.current);
				throttleTimerRef.current = setTimeout(() => setThrottled(false), 2500);
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
				const socket = new PartySocket({
					host: body.live.host,
					party: body.live.party,
					room: body.live.room,
					query: { token: body.live.token },
				});
				socketRef.current = socket;
				socket.addEventListener("open", () => setStatus("on"));
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
			clearTimeout(throttleTimerRef.current);
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

	return {
		status,
		viewers,
		bubbles,
		lastComment,
		throttled,
		dismissBubble,
		sendReaction,
		sendComment,
	};
}
