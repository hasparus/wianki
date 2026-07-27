import type { Page } from "@playwright/test";

const corsHeaders = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "GET,POST,PUT,OPTIONS",
	"access-control-allow-headers": "*",
};

/**
 * Stubs every network dependency of a photo upload (init, Supabase storage,
 * archive worker, finalize, gallery refresh) so the real browser-side flow —
 * derivative compression included — can run against the dev server without
 * Supabase, Drive, or Vision being configured.
 */
export async function installUploadBackendMocks(page: Page) {
	let nextPhotoId = 0;

	await page.route("**/api/uploads/init", async (route) => {
		const body = route.request().postDataJSON() as {
			files: { name: string }[];
		};
		await route.fulfill({
			json: {
				uploads: body.files.map(() => {
					nextPhotoId += 1;
					return {
						photoId: `e2e-photo-${nextPhotoId}`,
						path: `e2e/photo-${nextPhotoId}.jpg`,
						uploadToken: `upload-token-${nextPhotoId}`,
						archiveToken: `archive-token-${nextPhotoId}`,
					};
				}),
			},
		});
	});

	await page.route("https://example.supabase.co/**", async (route) => {
		if (route.request().method() === "OPTIONS") {
			await route.fulfill({ status: 200, headers: corsHeaders });
			return;
		}
		await route.fulfill({
			headers: corsHeaders,
			json: { Key: "gallery/e2e" },
		});
	});

	await page.route("https://archive.example.workers.dev/**", async (route) => {
		if (route.request().method() === "OPTIONS") {
			await route.fulfill({ status: 200, headers: corsHeaders });
			return;
		}
		await route.fulfill({
			headers: corsHeaders,
			json: { receipt: "e2e-receipt" },
		});
	});

	await page.route("**/api/uploads/*/finalize", async (route) => {
		await route.fulfill({
			json: { warning: null, moderationStatus: "pending" },
		});
	});

	await page.route("**/api/gallery", async (route) => {
		await route.fulfill({
			json: {
				items: [],
				nextCursor: null,
				stats: { approvedPhotos: 0, contributingGuests: 0 },
			},
		});
	});
}

/** Renders a real JPEG in the browser so compression and previews work. */
export async function makeJpegFile(page: Page, name: string, hue: number) {
	const bytes = await page.evaluate(async (fileHue) => {
		const canvas = document.createElement("canvas");
		canvas.width = 640;
		canvas.height = 480;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("canvas 2d context unavailable");
		const gradient = context.createLinearGradient(0, 0, 640, 480);
		gradient.addColorStop(0, `hsl(${fileHue}, 70%, 82%)`);
		gradient.addColorStop(1, `hsl(${fileHue + 40}, 60%, 55%)`);
		context.fillStyle = gradient;
		context.fillRect(0, 0, 640, 480);
		context.fillStyle = "rgba(255, 255, 255, 0.85)";
		context.beginPath();
		context.arc(320, 240, 110, 0, Math.PI * 2);
		context.fill();
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/jpeg", 0.9);
		});
		if (!blob) throw new Error("canvas toBlob failed");
		return Array.from(new Uint8Array(await blob.arrayBuffer()));
	}, hue);
	return { name, mimeType: "image/jpeg", buffer: Buffer.from(bytes) };
}
