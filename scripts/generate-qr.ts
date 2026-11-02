import { mkdir } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { loadLocalEnv } from "./lib/cli.ts";

/**
 * Print-ready entry QR codes for one site. The owner console shows the same
 * codes on screen; this writes 1600px PNGs for the print shop. Values come
 * from the site's settings page: SITE_ORIGIN is the gallery's origin and the
 * two tokens are the entry tokens shown under "Kody QR".
 *
 *   SITE_ORIGIN=https://rosia.wianki.app GUEST_ENTRY_TOKEN=… ADMIN_ENTRY_TOKEN=… \
 *     node scripts/generate-qr.ts
 */
const { SITE_ORIGIN, GUEST_ENTRY_TOKEN, ADMIN_ENTRY_TOKEN } = loadLocalEnv([
	"SITE_ORIGIN",
	"GUEST_ENTRY_TOKEN",
	"ADMIN_ENTRY_TOKEN",
]);

const output = path.resolve("private", "qr");
await mkdir(output, { recursive: true });
const style = {
	width: 1600,
	margin: 3,
	color: { dark: "#1A1A1A", light: "#F7F7F7" },
	errorCorrectionLevel: "H" as const,
};
await Promise.all([
	QRCode.toFile(
		path.join(output, "guest-qr.png"),
		`${SITE_ORIGIN}/?token=${encodeURIComponent(GUEST_ENTRY_TOKEN)}`,
		style,
	),
	QRCode.toFile(
		path.join(output, "admin-qr.png"),
		`${SITE_ORIGIN}/admin?token=${encodeURIComponent(ADMIN_ENTRY_TOKEN)}`,
		style,
	),
]);

console.log(`Wygenerowano prywatne kody QR w ${output}`);
