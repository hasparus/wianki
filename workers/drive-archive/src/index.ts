import { jwtVerify, SignJWT, type JWTPayload } from "jose";

export interface Env {
  ALLOWED_ORIGIN: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REFRESH_TOKEN: string;
  GOOGLE_DRIVE_FOLDER_ID: string;
  ARCHIVE_TOKEN_SECRET: string;
}

type Operation = "upload" | "delete" | "reconcile";

type OperationClaims = JWTPayload & {
  photoId: string;
  operation: Operation;
  filename?: string;
  contentType?: string;
  size?: number;
  driveFileId?: string;
};

const audience = "wedding-drive-archive";
const maxOriginalBytes = 25 * 1024 * 1024;
const encoder = new TextEncoder();

export function sanitizeDriveFilename(value: string) {
  return value.replace(/[\u0000-\u001f/\\]+/g, "-").slice(0, 180) || "zdjecie";
}

export function isBrowserOriginAllowed(origin: string | null, allowed: string) {
  return origin === allowed;
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  return isBrowserOriginAllowed(origin, env.ALLOWED_ORIGIN)
    ? {
        "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : {};
}

function json(
  value: unknown,
  status: number,
  origin: string | null,
  env: Env,
) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...corsHeaders(origin, env),
    },
  });
}

async function verifyOperation(request: Request, env: Env) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Brak tokenu operacji.");
  }
  const { payload } = await jwtVerify(
    authorization.slice("Bearer ".length),
    encoder.encode(env.ARCHIVE_TOKEN_SECRET),
    { algorithms: ["HS256"], audience },
  );
  if (
    typeof payload.photoId !== "string" ||
    !["upload", "delete", "reconcile"].includes(String(payload.operation))
  ) {
    throw new Error("Nieprawidłowy token operacji.");
  }
  return payload as OperationClaims;
}

async function googleAccessToken(env: Env) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Google OAuth odrzucił token odświeżania.");
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Google OAuth nie zwrócił tokenu.");
  return body.access_token;
}

async function receipt(
  env: Env,
  photoId: string,
  driveFileId: string,
  size: number,
) {
  return new SignJWT({ kind: "receipt", photoId, driveFileId, size })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setAudience(audience)
    .setExpirationTime("24h")
    .sign(encoder.encode(env.ARCHIVE_TOKEN_SECRET));
}

async function uploadOriginal(
  request: Request,
  env: Env,
  claims: OperationClaims,
) {
  if (
    claims.operation !== "upload" ||
    typeof claims.filename !== "string" ||
    typeof claims.contentType !== "string" ||
    typeof claims.size !== "number" ||
    claims.size <= 0 ||
    claims.size > maxOriginalBytes ||
    !request.body
  ) {
    throw new Error("Nieprawidłowe parametry oryginału.");
  }
  const requestLength = Number(request.headers.get("Content-Length") ?? claims.size);
  if (requestLength !== claims.size) throw new Error("Rozmiar pliku nie zgadza się z tokenem.");

  const accessToken = await googleAccessToken(env);
  const createResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": claims.contentType,
        "X-Upload-Content-Length": String(claims.size),
      },
      body: JSON.stringify({
        name: sanitizeDriveFilename(claims.filename),
        parents: [env.GOOGLE_DRIVE_FOLDER_ID],
        appProperties: { photoId: claims.photoId },
      }),
    },
  );
  const sessionUrl = createResponse.headers.get("Location");
  if (!createResponse.ok || !sessionUrl) {
    throw new Error("Nie udało się rozpocząć wysyłki do Drive.");
  }

  const uploadResponse = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": claims.contentType,
      "Content-Length": String(claims.size),
    },
    body: request.body,
  });
  if (!uploadResponse.ok) throw new Error("Drive nie przyjął oryginału.");
  const file = (await uploadResponse.json()) as { id?: string; size?: string };
  if (!file.id) throw new Error("Drive nie zwrócił identyfikatora pliku.");
  return {
    receipt: await receipt(env, claims.photoId, file.id, claims.size),
    driveFileId: file.id,
  };
}

async function reconcileOriginal(env: Env, claims: OperationClaims) {
  if (claims.operation !== "reconcile") throw new Error("Nieprawidłowa operacja.");
  const accessToken = await googleAccessToken(env);
  const query = `trashed = false and appProperties has { key='photoId' and value='${claims.photoId}' }`;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "files(id,size)");
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Nie udało się przeszukać Drive.");
  const body = (await response.json()) as {
    files?: Array<{ id: string; size?: string }>;
  };
  const file = body.files?.[0];
  if (!file) return null;
  const size = Number(file.size ?? 0);
  return {
    receipt: await receipt(env, claims.photoId, file.id, size),
    driveFileId: file.id,
  };
}

async function trashOriginal(env: Env, claims: OperationClaims) {
  if (claims.operation !== "delete" || !claims.driveFileId) {
    throw new Error("Brak pliku do usunięcia.");
  }
  const accessToken = await googleAccessToken(env);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(claims.driveFileId)}?supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
    },
  );
  if (!response.ok) throw new Error("Drive nie przeniósł pliku do kosza.");
  return { ok: true };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      if (!isBrowserOriginAllowed(origin, env.ALLOWED_ORIGIN)) {
        return json({ error: "Niedozwolone źródło." }, 403, origin, env);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    const match = new URL(request.url).pathname.match(
      /^\/v1\/archive\/([0-9a-f-]{36})$/,
    );
    if (!match) return json({ error: "Nie znaleziono." }, 404, origin, env);
    if (origin && !isBrowserOriginAllowed(origin, env.ALLOWED_ORIGIN)) {
      return json({ error: "Niedozwolone źródło." }, 403, origin, env);
    }

    try {
      const claims = await verifyOperation(request, env);
      if (claims.photoId !== match[1]) {
        return json({ error: "Token dotyczy innego zdjęcia." }, 403, origin, env);
      }
      if (request.method === "PUT") {
        return json(await uploadOriginal(request, env, claims), 201, origin, env);
      }
      if (request.method === "GET") {
        const result = await reconcileOriginal(env, claims);
        return result
          ? json(result, 200, origin, env)
          : json({ error: "Nie znaleziono oryginału." }, 404, origin, env);
      }
      if (request.method === "DELETE") {
        return json(await trashOriginal(env, claims), 200, origin, env);
      }
      return json({ error: "Niedozwolona metoda." }, 405, origin, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Błąd archiwum.";
      return json({ error: message }, 400, origin, env);
    }
  },
} satisfies ExportedHandler<Env>;
