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
    expect(response.headers()["set-cookie"]).toContain(
      "__Host-wedding_guest=",
    );
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

test("invalid manual passphrase stays on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Hasło z zaproszenia").fill("wrong password");
  await page.getByRole("button", { name: "Wejdź do galerii" }).click();
  await expect(
    page.getByText("Nieprawidłowe hasło z zaproszenia."),
  ).toBeVisible();
});
