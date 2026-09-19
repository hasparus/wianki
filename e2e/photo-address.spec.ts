import { expect, test } from "@playwright/test";

/** A 1×1 transparent PNG: enough for next/image, small enough to inline. */
const pixel =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const photos = [
	{
		id: "photo-tort",
		imageUrl: pixel,
		width: 1,
		height: 1,
		createdAt: "2026-09-19T10:00:00.000Z",
	},
	{
		id: "photo-taniec",
		imageUrl: pixel,
		width: 1,
		height: 1,
		createdAt: "2026-09-19T09:00:00.000Z",
	},
];

test.describe("a photograph has an address", () => {
	test.beforeEach(async ({ page, browserName }) => {
		test.skip(
			browserName === "webkit",
			"WebKit cannot retain the secure guest session on the local HTTP test origin.",
		);
		await page.clock.install();
		await page.route("**/api/gallery*", async (route) => {
			await route.fulfill({
				json: {
					items: photos,
					nextCursor: null,
					stats: { approvedPhotos: photos.length },
				},
			});
		});
	});

	/** The server page cannot reach Supabase in tests; the poll brings the photos. */
	async function pollGallery(page: import("@playwright/test").Page) {
		// The interval is registered on hydration, so wait for the page to live.
		await expect(
			page.getByRole("button", { name: "Wybierz zdjęcia" }),
		).toBeVisible();
		const plates = page.getByRole("button", { name: "Powiększ zdjęcie" });
		await expect
			.poll(async () => {
				await page.clock.fastForward(11_000);
				return plates.count();
			})
			.toBeGreaterThan(0);
	}

	test("opening a photo writes it into the URL and closing takes it back out", async ({
		page,
	}) => {
		await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
		await pollGallery(page);

		await page
			.getByRole("button", { name: "Powiększ zdjęcie" })
			.first()
			.click();
		await expect(page).toHaveURL(/\?p=photo-tort$/);
		const plate = page.getByRole("dialog", { name: "Powiększone zdjęcie" });
		await expect(plate).toBeVisible();

		await page.getByRole("button", { name: "Zamknij", exact: true }).click();
		await expect(plate).toBeHidden();
		await expect(page).not.toHaveURL(/p=/);
	});

	test("a shared address opens that photograph", async ({ page }) => {
		await page.goto(
			"/?token=e2e_guest_entry_token_value_32_bytes&p=photo-taniec",
		);
		await pollGallery(page);
		await expect(
			page.getByRole("dialog", { name: "Powiększone zdjęcie" }),
		).toBeVisible();
	});
});
