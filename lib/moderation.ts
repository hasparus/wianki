import { importPKCS8, SignJWT } from "jose";
import { serverEnv } from "@/lib/env";
import type { SafeSearchScores } from "@/lib/domain";

const riskyLikelihoods = new Set(["LIKELY", "VERY_LIKELY"]);
const googleScope = "https://www.googleapis.com/auth/cloud-platform";
const googleTokenAudience = "https://oauth2.googleapis.com/token";

export function classifySafeSearch(scores: SafeSearchScores) {
  return riskyLikelihoods.has(scores.adult) ||
    riskyLikelihoods.has(scores.racy) ||
    riskyLikelihoods.has(scores.violence)
    ? "flagged"
    : "approved";
}

async function googleAccessToken() {
  const env = serverEnv();
  const privateKey = await importPKCS8(
    env.GOOGLE_VISION_PRIVATE_KEY.replaceAll("\\n", "\n"),
    "RS256",
  );
  const assertion = await new SignJWT({ scope: googleScope })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(env.GOOGLE_VISION_CLIENT_EMAIL)
    .setSubject(env.GOOGLE_VISION_CLIENT_EMAIL)
    .setAudience(googleTokenAudience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const response = await fetch(googleTokenAudience, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Nie udało się uwierzytelnić Google Vision.");
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Google nie zwrócił tokenu dostępu.");
  return payload.access_token;
}

export async function moderateImage(image: Blob) {
  const env = serverEnv();
  const accessToken = await googleAccessToken();
  const content = Buffer.from(await image.arrayBuffer()).toString("base64");
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env.GOOGLE_CLOUD_PROJECT_ID)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content },
            features: [{ type: "SAFE_SEARCH_DETECTION" }],
          },
        ],
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Google Vision odrzucił żądanie.");
  const body = (await response.json()) as {
    responses?: Array<{
      safeSearchAnnotation?: {
        adult?: string;
        racy?: string;
        violence?: string;
        medical?: string;
        spoof?: string;
      };
      error?: { message?: string };
    }>;
  };
  const first = body.responses?.[0];
  if (first?.error || !first?.safeSearchAnnotation) {
    throw new Error(first?.error?.message ?? "Brak wyniku SafeSearch.");
  }
  const annotation = first.safeSearchAnnotation;
  const scores: SafeSearchScores = {
    adult: annotation.adult ?? "UNKNOWN",
    racy: annotation.racy ?? "UNKNOWN",
    violence: annotation.violence ?? "UNKNOWN",
    medical: annotation.medical,
    spoof: annotation.spoof,
  };
  return { status: classifySafeSearch(scores), scores } as const;
}
