/**
 * Reads the error message these handlers send back, falling back when the
 * response is not the JSON we expect (a proxy error page, an empty body).
 */
export async function readError(response: Response, fallback: string) {
	const body = (await response.json().catch(() => null)) as {
		error?: string;
	} | null;
	return body?.error ?? fallback;
}
