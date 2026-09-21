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
	...Array.from({ length: 10 }, (_, index) => ({
		id: `photo-${index + 3}`,
		imageUrl: pixel,
		width: index % 2 ? 4 : 3,
		height: index % 2 ? 3 : 4,
		createdAt: `2026-09-19T08:${String(index).padStart(2, "0")}:00.000Z`,
	})),
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
		await page.evaluate(() =>
			window.scrollTo(0, document.documentElement.scrollHeight),
		);
		const plates = page.getByRole("button", { name: "Powiększ zdjęcie" });
		await expect
			.poll(async () => {
				await page.clock.fastForward(11_000);
				return plates.count();
			})
			.toBeGreaterThan(0);
	}

	test("fills the screen, scrolls sideways, and pinches without changing height", async ({
		page,
	}) => {
		await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
		await pollGallery(page);

		const rail = page.getByRole("region", { name: "Zdjęcia", exact: true });
		await rail.scrollIntoViewIfNeeded();
		const before = await rail.evaluate((element) => ({
			height: element.clientHeight,
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		}));
		expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);
		const viewportWidth = await page.evaluate(() => window.innerWidth);
		expect(Math.abs(before.clientWidth - viewportWidth)).toBeLessThanOrEqual(1);
		await rail.evaluate((element) => {
			element.scrollLeft = 200;
		});
		await expect
			.poll(() => rail.evaluate((element) => element.scrollLeft))
			.toBe(200);

		const photoNearestCenter = () =>
			rail.evaluate((element) => {
				const viewport = element.getBoundingClientRect();
				const x = viewport.left + viewport.width / 2;
				const y = viewport.top + viewport.height / 2;
				return Array.from(
					element.querySelectorAll<HTMLElement>(
						"[data-gallery-current] [data-photo-id]",
					),
				).reduce<{ id: string; distance: number } | null>((nearest, plate) => {
					const rect = plate.getBoundingClientRect();
					const dx = Math.max(rect.left - x, 0, x - rect.right);
					const dy = Math.max(rect.top - y, 0, y - rect.bottom);
					const candidate = {
						id: plate.dataset.photoId ?? "",
						distance: Math.hypot(dx, dy),
					};
					return !nearest || candidate.distance < nearest.distance
						? candidate
						: nearest;
				}, null)?.id;
			});
		const focalPhoto = await photoNearestCenter();
		const focalPhotoIsVisible = () =>
			rail.evaluate((element, photoId) => {
				const viewport = element.getBoundingClientRect();
				const plate = element.querySelector<HTMLElement>(
					`[data-gallery-current] [data-photo-id="${CSS.escape(photoId ?? "")}"]`,
				);
				if (!plate) return false;
				const rect = plate.getBoundingClientRect();
				return rect.right > viewport.left && rect.left < viewport.right;
			}, focalPhoto);

		const pinch = (startRadius: number, endRadius: number) =>
			rail.evaluate(
				(element, radii) => {
					const rect = element.getBoundingClientRect();
					const x = rect.left + rect.width / 2;
					const y = rect.top + rect.height / 2;
					const touch = (id: number, clientX: number) =>
						new Touch({
							identifier: id,
							target: element,
							clientX,
							clientY: y,
						});
					const dispatch = (
						type: "touchstart" | "touchmove",
						radius: number,
					) => {
						const touches = [touch(1, x - radius), touch(2, x + radius)];
						element.dispatchEvent(
							new TouchEvent(type, {
								touches,
								changedTouches: touches,
								bubbles: true,
								cancelable: true,
							}),
						);
					};
					dispatch("touchstart", radii.start);
					dispatch("touchmove", radii.end);
					element.dispatchEvent(
						new TouchEvent("touchend", {
							touches: [],
							changedTouches: [],
							bubbles: true,
							cancelable: true,
						}),
					);
				},

				{ start: startRadius, end: endRadius },
			);

		const currentPlate = () =>
			rail.locator("[data-gallery-current] [data-photo-id]").first();
		const plateHeight = await currentPlate().evaluate(
			(element) => element.clientHeight,
		);
		await pinch(60, 90);
		await expect(rail.locator("ul")).toHaveCount(2);
		await expect(rail.locator('ul[aria-hidden="true"]')).toHaveCount(1);
		expect(
			await currentPlate().evaluate((element) => element.clientHeight),
		).toBe(before.height);
		await expect(rail.locator("ul")).toHaveCount(1);
		expect(await focalPhotoIsVisible()).toBe(true);

		await pinch(90, 45);
		await expect(rail.locator("ul")).toHaveCount(2);
		await expect(rail.locator('ul[aria-hidden="true"]')).toHaveCount(1);
		expect(
			await currentPlate().evaluate((element) => element.clientHeight),
		).toBe(plateHeight);
		await expect(rail.locator("ul")).toHaveCount(1);
		expect(await focalPhotoIsVisible()).toBe(true);
		expect(await rail.evaluate((element) => element.clientHeight)).toBe(
			before.height,
		);

		const iconStyle = await page
			.getByRole("button", { name: "Mniejsze zdjęcia" })
			.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					background: style.backgroundColor,
					border: style.borderTopWidth,
				};
			});
		expect(iconStyle).toEqual({
			background: "rgba(0, 0, 0, 0)",
			border: "0px",
		});
	});

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
