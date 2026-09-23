import { expect, test } from "@playwright/test";
import sharp from "sharp";

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
	async function pollGallery(
		page: import("@playwright/test").Page,
		advanceClock = true,
	) {
		// The interval is registered on hydration, so wait for the page to live.
		await expect(
			page.getByRole("button", { name: "Wybierz zdjęcia" }),
		).toBeVisible();
		await page.evaluate(() =>
			window.scrollTo(0, document.documentElement.scrollHeight),
		);
		const plates = page.getByRole("button", { name: "Powiększ zdjęcie" });
		if (advanceClock) {
			await expect
				.poll(async () => {
					await page.clock.fastForward(11_000);
					return plates.count();
				})
				.toBeGreaterThan(0);
			return;
		}
		await expect(plates.first()).toBeVisible({ timeout: 15_000 });
	}

	test("shows a stored blur preview while the full photograph is still loading", async ({
		page,
	}) => {
		await page.clock.install();
		const tiny = await sharp({
			create: {
				width: 8,
				height: 8,
				channels: 3,
				background: "#555555",
			},
		})
			.jpeg()
			.toBuffer();
		const blurDataUrl = `data:image/jpeg;base64,${tiny.toString("base64")}`;
		await page.unroute("**/api/gallery*");
		await page.route("**/api/gallery*", async (route) => {
			await route.fulfill({
				json: {
					items: [
						{
							...photos[0],
							imageUrl: "https://photos.example.test/photo.jpg",
							blurDataUrl,
						},
					],
					nextCursor: null,
					stats: { approvedPhotos: 1 },
				},
			});
		});
		let releaseImage: (() => void) | undefined;
		await page.route("https://photos.example.test/photo.jpg", async (route) => {
			await new Promise<void>((resolve) => {
				releaseImage = resolve;
			});
			await route.fulfill({
				contentType: "image/jpeg",
				body: tiny,
			});
		});
		try {
			await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
			await pollGallery(page);
			const image = page.locator(
				'[data-gallery-current] img[src*="photos.example.test"]',
			);
			await expect(image).toBeVisible();
			const preview = page.locator(
				"[data-gallery-current] [data-photo-id] span[aria-hidden]",
			);
			await expect(preview).toHaveCSS("background-image", /data:image\/jpeg/);
			await expect(image).toHaveCSS("opacity", "0");
			await expect.poll(() => Boolean(releaseImage)).toBe(true);
			releaseImage?.();
			await expect(image).toHaveClass(/opacity-100/);
		} finally {
			releaseImage?.();
		}
	});

	test("fills the screen, scrolls sideways, and pinches without changing height", async ({
		page,
	}) => {
		await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
		await pollGallery(page, false);

		const rail = page.getByRole("region", { name: "Zdjęcia", exact: true });
		await rail.scrollIntoViewIfNeeded();
		const gallery = page.getByRole("region", {
			name: "Galeria",
			exact: true,
		});
		const before = await rail.evaluate((element) => ({
			height: element.clientHeight,
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		}));
		const viewport = await page.evaluate(() => ({
			width: window.innerWidth,
			height: window.innerHeight,
		}));
		const galleryBounds = await gallery.boundingBox();
		const railBounds = await rail.boundingBox();
		expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);
		expect(Math.abs(before.clientWidth - viewport.width)).toBeLessThanOrEqual(
			1,
		);
		expect(
			Math.abs((galleryBounds?.height ?? 0) - viewport.height),
		).toBeLessThanOrEqual(1);
		expect(
			Math.abs(
				(galleryBounds?.y ?? 0) +
					(galleryBounds?.height ?? 0) -
					((railBounds?.y ?? 0) + (railBounds?.height ?? 0)),
			),
		).toBeLessThanOrEqual(1);
		expect(before.height).toBeGreaterThan(viewport.height / 2);
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
		const outgoingAfterZoomIn = rail.locator('ul[aria-hidden="true"]');
		await expect(outgoingAfterZoomIn).toHaveCount(1);
		await expect(outgoingAfterZoomIn).toHaveAttribute("inert", "");
		expect(
			await outgoingAfterZoomIn.evaluate(
				(element) => (element as HTMLElement).inert,
			),
		).toBe(true);
		expect(
			await currentPlate().evaluate((element) => element.clientHeight),
		).toBe(before.height);
		await expect(rail.locator("ul")).toHaveCount(1);
		expect(await focalPhotoIsVisible()).toBe(true);

		await pinch(90, 45);
		await expect(rail.locator("ul")).toHaveCount(2);
		const outgoingAfterZoomOut = rail.locator('ul[aria-hidden="true"]');
		await expect(outgoingAfterZoomOut).toHaveCount(1);
		await expect(outgoingAfterZoomOut).toHaveAttribute("inert", "");
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
		expect(
			await rail.evaluate((element) => getComputedStyle(element).touchAction),
		).toBe("pan-x pan-y");

		const cdp = await page.context().newCDPSession(page);
		await cdp.send("Emulation.setTouchEmulationEnabled", {
			enabled: true,
			maxTouchPoints: 2,
		});
		await rail.scrollIntoViewIfNeeded();
		const touchTarget = await rail.boundingBox();
		const scrollBeforeTouch = await page.evaluate(() => window.scrollY);
		const x = (touchTarget?.x ?? 0) + (touchTarget?.width ?? 0) / 2;
		const startY = (touchTarget?.y ?? 0) + (touchTarget?.height ?? 0) / 2;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ x, y: startY, id: 1 }],
		});
		for (let distance = 20; distance <= 100; distance += 20) {
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [{ x, y: startY + distance, id: 1 }],
			});
		}
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		await expect
			.poll(() => page.evaluate(() => window.scrollY))
			.toBeLessThan(scrollBeforeTouch);
	});

	test("keeps the middle photo fixed during button zoom without sliding the outgoing rail", async ({
		page,
	}) => {
		await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
		await pollGallery(page, false);

		const rail = page.getByRole("region", { name: "Zdjęcia", exact: true });
		await rail.scrollIntoViewIfNeeded();
		await rail.evaluate((element) => {
			element.scrollLeft = Math.min(
				900,
				element.scrollWidth - element.clientWidth,
			);
		});
		const middlePhoto = () =>
			rail.evaluate((element) => {
				const viewport = element.getBoundingClientRect();
				const x = viewport.left + viewport.width / 2;
				const y = viewport.top + viewport.height / 2;
				const plate = Array.from(
					element.querySelectorAll<HTMLElement>(
						"[data-gallery-current] [data-photo-id]",
					),
				).reduce<HTMLElement | null>((nearest, candidate) => {
					const distance = (photo: HTMLElement) => {
						const rect = photo.getBoundingClientRect();
						return Math.hypot(
							Math.max(rect.left - x, 0, x - rect.right),
							Math.max(rect.top - y, 0, y - rect.bottom),
						);
					};
					return !nearest || distance(candidate) < distance(nearest)
						? candidate
						: nearest;
				}, null);
				if (!plate) return null;
				const rect = plate.getBoundingClientRect();
				return {
					id: plate.dataset.photoId ?? "",
					left: rect.left,
					width: rect.width,
					focalX: Math.max(rect.left, Math.min(x, rect.right)),
				};
			});
		const before = await middlePhoto();
		expect(before).not.toBeNull();

		await page.getByRole("button", { name: "Większe zdjęcia" }).click();
		const outgoing = rail.locator('ul[aria-hidden="true"]');
		await expect(outgoing).toHaveCount(1);
		const photoId = before?.id ?? "";
		const after = await rail.evaluate((element, id) => {
			const oldPlate = element.querySelector<HTMLElement>(
				`ul[aria-hidden="true"] [data-photo-id="${CSS.escape(id)}"]`,
			);
			const newPlate = element.querySelector<HTMLElement>(
				`[data-gallery-current] [data-photo-id="${CSS.escape(id)}"]`,
			);
			const viewport = element.getBoundingClientRect();
			return {
				oldLeft: oldPlate?.getBoundingClientRect().left,
				newLeft: newPlate?.getBoundingClientRect().left,
				newWidth: newPlate?.getBoundingClientRect().width,
				viewportCenter: viewport.left + viewport.width / 2,
			};
		}, photoId);
		expect(
			Math.abs((after.oldLeft ?? 0) - (before?.left ?? 0)),
		).toBeLessThanOrEqual(1);
		const fraction =
			((before?.focalX ?? 0) - (before?.left ?? 0)) / (before?.width ?? 1);
		expect(
			Math.abs(
				(after.newLeft ?? 0) +
					fraction * (after.newWidth ?? 0) -
					after.viewportCenter,
			),
		).toBeLessThanOrEqual(2);
		await expect(outgoing).toHaveCount(0);
	});

	test("keeps the viewed photograph still when polling prepends photos", async ({
		page,
	}) => {
		await page.clock.install();
		await page.unroute("**/api/gallery*");
		let feed = photos;
		await page.route("**/api/gallery*", async (route) => {
			await route.fulfill({
				json: {
					items: feed,
					nextCursor: null,
					stats: { approvedPhotos: feed.length },
				},
			});
		});
		await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
		await pollGallery(page);

		const rail = page.getByRole("region", { name: "Zdjęcia", exact: true });
		await rail.scrollIntoViewIfNeeded();
		await rail.evaluate((element) => {
			element.scrollLeft = 400;
		});
		const focalPosition = () =>
			rail.evaluate((element) => {
				const viewport = element.getBoundingClientRect();
				const plate = Array.from(
					element.querySelectorAll<HTMLElement>(
						"[data-gallery-current] [data-photo-id]",
					),
				).find(
					(candidate) =>
						candidate.getBoundingClientRect().right > viewport.left + 1,
				);
				if (!plate) return null;
				const rect = plate.getBoundingClientRect();
				return {
					id: plate.dataset.photoId,
					x: rect.left - viewport.left,
					y: rect.top - viewport.top,
				};
			});
		const before = await focalPosition();
		expect(before).not.toBeNull();

		const prependAndExpectStable = async (id: string) => {
			feed = [
				{
					id,
					imageUrl: pixel,
					width: 3,
					height: 4,
					createdAt: new Date().toISOString(),
				},
				...feed,
			];
			await page.clock.fastForward(11_000);
			await expect(
				rail.locator("[data-gallery-current] [data-photo-id]"),
			).toHaveCount(feed.length);
			const after = await focalPosition();
			expect(after?.id).toBe(before?.id);
			expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThanOrEqual(
				1,
			);
			expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(
				1,
			);
		};

		await prependAndExpectStable("fresh-photo-1");
		await prependAndExpectStable("fresh-photo-2");
	});

	test("removes outgoing layers immediately when motion is reduced", async ({
		page,
	}) => {
		await page.clock.install();
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
		await pollGallery(page);

		const rail = page.getByRole("region", { name: "Zdjęcia", exact: true });
		await page.getByRole("button", { name: "Większe zdjęcia" }).click();
		await expect(rail.locator("ul")).toHaveCount(1);
		await expect(rail.locator('ul[aria-hidden="true"]')).toHaveCount(0);
	});

	test("opening a photo writes it into the URL and closing takes it back out", async ({
		page,
	}) => {
		await page.clock.install();
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
		await page.clock.install();
		await page.goto(
			"/?token=e2e_guest_entry_token_value_32_bytes&p=photo-taniec",
		);
		await pollGallery(page);
		await expect(
			page.getByRole("dialog", { name: "Powiększone zdjęcie" }),
		).toBeVisible();
	});
});
