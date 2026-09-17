import { expect, test } from "@playwright/test";
import { installUploadBackendMocks, makeJpegFile } from "./upload-mocks";

test("guest can keep uploading after a batch completes and sees previews of sent photos", async ({
	page,
	browserName,
}, testInfo) => {
	test.skip(
		browserName === "webkit",
		"WebKit cannot retain the secure guest session on the local HTTP test origin.",
	);
	await installUploadBackendMocks(page);
	await page.goto("/?token=e2e_guest_entry_token_value_32_bytes");

	const fileInput = page.locator('input[type="file"]');
	await fileInput.setInputFiles([
		await makeJpegFile(page, "pierwszy-taniec.jpg", 340),
		await makeJpegFile(page, "tort.jpg", 200),
	]);

	// Previews appear as soon as photos are picked.
	const pendingList = page.getByRole("list").filter({ hasText: "Oczekuje" });
	await expect(pendingList.locator("img")).toHaveCount(2);

	// No consent checkbox: pressing upload implies consent, stated below it.
	await expect(page.getByText(/Wysyłając zdjęcia, zgadzasz się/)).toBeVisible();
	await page.getByRole("button", { name: "Wyślij zdjęcia" }).click();

	// Completion is not a dead end: no "close the page" copy, sent photos stay
	// visible with previews, and the picker invites another batch.
	await expect(page.getByRole("status")).toContainText("pojawią się w galerii");
	await expect(page.getByRole("status")).not.toContainText("zamknąć tę stronę");
	const sentSection = page.getByRole("region", {
		name: "Twoje wysłane zdjęcia",
	});
	await expect(sentSection.locator("img")).toHaveCount(2);
	const addMore = page.getByRole("button", { name: "Dodaj zdjęcia" });
	await expect(addMore).toBeEnabled();
	// Zero gallery stats stay hidden instead of bragging about "0 zdjęć".
	await expect(page.getByText(/0 gości/)).toHaveCount(0);
	await page.screenshot({
		path: testInfo.outputPath("after-first-batch.png"),
		fullPage: true,
	});

	// Second batch: previously sent photos remain on screen alongside it.
	await fileInput.setInputFiles([
		await makeJpegFile(page, "oczepiny.jpg", 100),
	]);
	await expect(sentSection.locator("img")).toHaveCount(2);
	await expect(pendingList.locator("img")).toHaveCount(1);
	await page.screenshot({
		path: testInfo.outputPath("second-batch-picked.png"),
		fullPage: true,
	});

	await page.getByRole("button", { name: "Wyślij zdjęcia" }).click();
	await expect(sentSection.locator("img")).toHaveCount(3);
	await expect(page.getByRole("status")).toContainText("pojawią się w galerii");
	await page.screenshot({
		path: testInfo.outputPath("after-second-batch.png"),
		fullPage: true,
	});
});
