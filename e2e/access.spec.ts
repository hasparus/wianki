import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("guest entry token is removed and grants a signed session", async ({
	page,
	request,
	browserName,
}) => {
	if (browserName === "webkit") {
		const response = await request.get(
			"/?token=e2e_guest_entry_token_value_32_bytes",
			{ maxRedirects: 0 },
		);
		expect([307, 308]).toContain(response.status());
		expect(response.headers().location).toBe("/");
		expect(response.headers()["set-cookie"]).toContain("__Host-wedding_guest=");
		expect(response.headers()["set-cookie"]).toContain("Secure");
		return;
	}
	await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
	await expect(page).toHaveURL("/");
	const cookies = await page.context().cookies();
	expect(cookies.some((cookie) => cookie.name === "__Host-wedding_guest")).toBe(
		true,
	);
});

test("login and privacy pages have no serious accessibility violations", async ({
	page,
}) => {
	for (const path of ["/login", "/privacy"]) {
		await page.goto(path);
		const results = await new AxeBuilder({ page })
			.disableRules(["color-contrast"])
			.analyze();
		expect(
			results.violations.filter((violation) =>
				["serious", "critical"].includes(violation.impact ?? ""),
			),
		).toEqual([]);
	}
});

test("short join code grants a guest session and opens the slideshow", async ({
	page,
	browserName,
}) => {
	test.skip(
		browserName === "webkit",
		"WebKit cannot retain the secure guest session on the local HTTP test origin.",
	);
	await page.goto("/p/e2e-join-code");
	await expect(page).toHaveURL("/pokaz");
	const cookies = await page.context().cookies();
	expect(cookies.some((cookie) => cookie.name === "__Host-wedding_guest")).toBe(
		true,
	);
});

test("wrong join code bounces to login without a session", async ({ page }) => {
	await page.goto("/p/definitely-wrong");
	await expect(page).toHaveURL("/login");
	const cookies = await page.context().cookies();
	expect(cookies.some((cookie) => cookie.name === "__Host-wedding_guest")).toBe(
		false,
	);
});

test("invalid manual passphrase stays on login", async ({ page }) => {
	await page.goto("/login");
	await page.getByLabel("Hasło").fill("wrong password");
	await page.getByRole("button", { name: "Wejdź do galerii" }).click();
	await expect(page.getByText("Nieprawidłowe hasło.")).toBeVisible();
});

test("upload selection rejects more than ten photos before a network upload", async ({
	page,
	browserName,
}) => {
	test.skip(
		browserName === "webkit",
		"WebKit cannot retain the secure guest session on the local HTTP test origin.",
	);
	await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");
	await page.locator('input[type="file"]').setInputFiles(
		Array.from({ length: 11 }, (_, index) => ({
			name: `wesele-${index}.jpg`,
			mimeType: "image/jpeg",
			buffer: Buffer.from("photo"),
		})),
	);
	await expect(
		page.getByText("W jednym podejściu możesz wybrać maksymalnie 10 zdjęć."),
	).toBeVisible();
});
