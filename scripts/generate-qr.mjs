import { mkdir } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const origin = process.env.APP_ORIGIN;
const guestToken = process.env.GUEST_ENTRY_TOKEN;
const adminToken = process.env.ADMIN_ENTRY_TOKEN;

if (!origin || !guestToken || !adminToken) {
  throw new Error(
    "Ustaw APP_ORIGIN, GUEST_ENTRY_TOKEN i ADMIN_ENTRY_TOKEN przed generowaniem.",
  );
}

const output = path.resolve("private", "qr");
await mkdir(output, { recursive: true });
await Promise.all([
  QRCode.toFile(
    path.join(output, "guest-qr.png"),
    `${origin}/?token=${guestToken}`,
    {
      width: 1600,
      margin: 3,
      color: { dark: "#2A482F", light: "#FBF6EF" },
      errorCorrectionLevel: "H",
    },
  ),
  QRCode.toFile(
    path.join(output, "admin-qr.png"),
    `${origin}/admin?token=${adminToken}`,
    {
      width: 1600,
      margin: 3,
      color: { dark: "#2A482F", light: "#FBF6EF" },
      errorCorrectionLevel: "H",
    },
  ),
]);

console.log(`Wygenerowano prywatne kody QR w ${output}`);
