import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
const port = 53682;
const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
const scope = "https://www.googleapis.com/auth/drive.file";

if (!clientId || !clientSecret) {
  throw new Error(
    "Ustaw GOOGLE_DRIVE_OAUTH_CLIENT_ID i GOOGLE_DRIVE_OAUTH_CLIENT_SECRET.",
  );
}

const state = randomBytes(24).toString("base64url");
const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authorization.searchParams.set("client_id", clientId);
authorization.searchParams.set("redirect_uri", redirectUri);
authorization.searchParams.set("response_type", "code");
authorization.searchParams.set("scope", scope);
authorization.searchParams.set("access_type", "offline");
authorization.searchParams.set("prompt", "consent");
authorization.searchParams.set("state", state);

console.log("Otwórz ten adres w przeglądarce i zezwól na dostęp:");
console.log(authorization.toString());

const code = await new Promise((resolve, reject) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", redirectUri);
    if (url.pathname !== "/oauth/callback") {
      response.writeHead(404).end();
      return;
    }
    if (url.searchParams.get("state") !== state) {
      response.writeHead(400).end("Nieprawidłowy parametr state.");
      server.close();
      reject(new Error("OAuth state mismatch."));
      return;
    }
    const value = url.searchParams.get("code");
    if (!value) {
      response.writeHead(400).end("Brak kodu OAuth.");
      server.close();
      reject(new Error("Google nie zwrócił kodu OAuth."));
      return;
    }
    response
      .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
      .end("Gotowe. Możesz zamknąć tę kartę.");
    server.close();
    resolve(value);
  });
  server.listen(port, "127.0.0.1");
});

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code,
  }),
});
if (!tokenResponse.ok) throw new Error("Nie udało się wymienić kodu OAuth.");
const tokens = await tokenResponse.json();
if (!tokens.refresh_token || !tokens.access_token) {
  throw new Error("Google nie zwrócił refresh tokenu. Cofnij dostęp i spróbuj ponownie.");
}

const folderResponse = await fetch(
  "https://www.googleapis.com/drive/v3/files?fields=id",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Wesele – oryginały",
      mimeType: "application/vnd.google-apps.folder",
    }),
  },
);
if (!folderResponse.ok) throw new Error("Nie udało się utworzyć folderu Drive.");
const folder = await folderResponse.json();

const outputDirectory = path.resolve("oauth-output");
await mkdir(outputDirectory, { recursive: true });
const outputFile = path.join(outputDirectory, "drive-oauth.json");
await writeFile(
  outputFile,
  JSON.stringify(
    {
      GOOGLE_OAUTH_CLIENT_ID: clientId,
      GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
      GOOGLE_OAUTH_REFRESH_TOKEN: tokens.refresh_token,
      GOOGLE_DRIVE_FOLDER_ID: folder.id,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(`Zapisano prywatny wynik w ${outputFile}. Nie dodawaj go do Git.`);
