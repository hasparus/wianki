export function assertSameOrigin(request: Request, expectedOrigin: string) {
	const origin = request.headers.get("origin");
	if (!origin || origin !== expectedOrigin) {
		throw new Response("Nieprawidłowe źródło żądania.", { status: 403 });
	}
}

export function jsonError(message: string, status: number) {
	return Response.json({ error: message }, { status });
}

export function noStoreJson(value: unknown, init?: ResponseInit) {
	const response = Response.json(value, init);
	response.headers.set("Cache-Control", "private, no-store");
	return response;
}
