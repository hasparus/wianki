import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
	cookies: async () => ({ get: () => undefined }),
	headers: async () => new Headers(),
}));

import {
	AccountError,
	consumeLoginToken,
	createSite,
	findAccountByEmail,
	findOrCreateAccount,
	issueLoginToken,
	listSitesForAccount,
	requireOwnedSite,
	rotateEntryToken,
	updateSiteSettings,
} from "@/lib/accounts";
import { verifyPassphrase } from "@/lib/auth/secrets";
import { first, run } from "@/lib/db";
import { setupSite } from "./helpers/site";

const OTHER_ACCOUNT = "99999999-9999-4999-8999-999999999999";

async function setup() {
	const context = await setupSite();
	await run("insert into accounts (id, email) values (?, ?)", [
		OTHER_ACCOUNT,
		"someone-else@example.com",
	]);
	return context;
}

const validSite = {
	slug: "ania-tomek",
	title: "Ania & Tomek",
	guestPassphrase: "wesele 2026",
	adminPassphrase: "admin passphrase long",
	deletionContactEmail: "Ania@Example.com",
};

beforeEach(async () => {
	await setup();
});

describe("magic-link tokens", () => {
	it("is single use and creates the account on first login", async () => {
		const { token } = await issueLoginToken("New.Owner@example.com");
		expect(token.length).toBeGreaterThanOrEqual(43);
		const stored = await first<{ token_hash: string; email: string }>(
			"select token_hash, email from login_tokens",
		);
		expect(stored?.email).toBe("new.owner@example.com");
		expect(stored?.token_hash).not.toBe(token);

		const account = await consumeLoginToken(token);
		expect(account?.email).toBe("new.owner@example.com");
		expect(account?.last_login_at).toBeTruthy();
		expect(await findAccountByEmail("new.owner@example.com")).not.toBeNull();

		expect(await consumeLoginToken(token)).toBeNull();
	});

	it("rejects an expired token", async () => {
		const { token } = await issueLoginToken("owner@example.com");
		await run("update login_tokens set expires_at = ?", [
			new Date(Date.now() - 1000).toISOString(),
		]);
		expect(await consumeLoginToken(token)).toBeNull();
	});

	it("rejects garbage and retires older unused tokens of the same address", async () => {
		expect(await consumeLoginToken("not-a-token")).toBeNull();
		expect(await consumeLoginToken(null)).toBeNull();

		const first1 = await issueLoginToken("owner@example.com");
		const second = await issueLoginToken("owner@example.com");
		expect(await consumeLoginToken(first1.token)).toBeNull();
		expect((await consumeLoginToken(second.token))?.email).toBe(
			"owner@example.com",
		);
	});

	it("reuses an existing account for the same address", async () => {
		const a = await findOrCreateAccount("Owner@Example.com");
		const b = await findOrCreateAccount("owner@example.com");
		expect(a.id).toBe(b.id);
	});
});

describe("createSite", () => {
	it("stores hashed passphrases, fresh entry tokens and a trial plan", async () => {
		const { accountId } = await setup();
		const site = await createSite(accountId, validSite);
		expect(site.slug).toBe("ania-tomek");
		expect(site.plan_status).toBe("trial");
		expect(site.deletion_contact_email).toBe("ania@example.com");
		expect(site.origin).toBe("https://ania-tomek.wianki.test");
		expect(site.guest_passphrase_hash).not.toContain("wesele");
		expect(
			await verifyPassphrase("wesele 2026", site.guest_passphrase_hash),
		).toBe(true);
		expect(
			await verifyPassphrase(
				"admin passphrase long",
				site.admin_passphrase_hash,
			),
		).toBe(true);
		expect(site.guest_entry_token).not.toBe(site.admin_entry_token);
		expect(site.guest_entry_token.length).toBeGreaterThanOrEqual(43);
		expect((await listSitesForAccount(accountId)).map((s) => s.slug)).toEqual([
			"rosia",
			"ania-tomek",
		]);
	});

	it("rejects reserved, malformed and taken slugs", async () => {
		const { accountId } = await setup();
		for (const slug of ["www", "konto", "api", "-abc", "ab", "ania!", "a b"]) {
			await expect(
				createSite(accountId, { ...validSite, slug }),
			).rejects.toBeInstanceOf(AccountError);
		}
		await expect(
			createSite(accountId, { ...validSite, slug: "demo" }),
		).resolves.toMatchObject({
			slug: "demo",
		});
		await expect(
			createSite(accountId, { ...validSite, slug: "rosia" }),
		).rejects.toMatchObject({
			status: 409,
		});
	});

	it("rejects an admin passphrase that equals the guest passphrase", async () => {
		const { accountId } = await setup();
		await expect(
			createSite(accountId, {
				...validSite,
				adminPassphrase: validSite.guestPassphrase,
			}),
		).rejects.toBeInstanceOf(AccountError);
	});
});

describe("ownership", () => {
	it("hides a site from any account but its owner", async () => {
		const { site, accountId } = await setup();
		expect((await requireOwnedSite(site.id, accountId))?.id).toBe(site.id);
		expect(await requireOwnedSite(site.id, OTHER_ACCOUNT)).toBeNull();
		expect(
			await updateSiteSettings(site.id, OTHER_ACCOUNT, { title: "Przejęte" }),
		).toBeNull();
		expect(await rotateEntryToken(site.id, OTHER_ACCOUNT, "admin")).toBeNull();
		expect((await requireOwnedSite(site.id, accountId))?.title).toBe(
			"Rosia & Piotrek",
		);
		expect(await listSitesForAccount(OTHER_ACCOUNT)).toEqual([]);
	});
});

describe("updateSiteSettings", () => {
	it("writes only the keys present and re-hashes passphrases", async () => {
		const { site, accountId } = await setup();
		const updated = await updateSiteSettings(site.id, accountId, {
			title: "Rosia i Piotrek",
			eventDate: "2026-08-15",
			guestJoinCode: "wesele-26",
			guestOpenUntil: "2026-08-15T22:00:00+02:00",
			moderationEnabled: true,
			deletionContactEmail: null,
			customDomain: "Zdjecia.Nasze-Wesele.pl",
			guestPassphrase: "nowe haslo",
		});
		expect(updated).toMatchObject({
			title: "Rosia i Piotrek",
			event_date: "2026-08-15",
			guest_join_code: "wesele-26",
			guest_open_until: "2026-08-15T20:00:00.000Z",
			moderationEnabled: true,
			deletion_contact_email: null,
			custom_domain: "zdjecia.nasze-wesele.pl",
			origin: "https://zdjecia.nasze-wesele.pl",
		});
		expect(
			await verifyPassphrase("nowe haslo", updated?.guest_passphrase_hash),
		).toBe(true);
		expect(
			await verifyPassphrase(
				"admin passphrase long",
				updated?.admin_passphrase_hash,
			),
		).toBe(true);

		const cleared = await updateSiteSettings(site.id, accountId, {
			customDomain: null,
		});
		expect(cleared?.custom_domain).toBeNull();
		expect(cleared?.origin).toBe("https://rosia.wianki.test");
	});

	it("rejects bad values and a domain under the platform host", async () => {
		const { site, accountId } = await setup();
		await expect(
			updateSiteSettings(site.id, accountId, { customDomain: "x.wianki.test" }),
		).rejects.toBeInstanceOf(AccountError);
		await expect(
			updateSiteSettings(site.id, accountId, { customDomain: "not a host" }),
		).rejects.toBeInstanceOf(AccountError);
		await expect(
			updateSiteSettings(site.id, accountId, { eventDate: "15.08.2026" }),
		).rejects.toBeInstanceOf(AccountError);
		await expect(
			updateSiteSettings(site.id, accountId, { adminPassphrase: "short" }),
		).rejects.toBeInstanceOf(AccountError);
		await expect(
			updateSiteSettings(site.id, accountId, { title: "" }),
		).rejects.toBeInstanceOf(AccountError);
	});

	it("refuses a custom domain another site already uses", async () => {
		const { site, accountId } = await setup();
		const other = await createSite(accountId, validSite);
		await updateSiteSettings(other.id, accountId, {
			customDomain: "zdjecia.example.com",
		});
		await expect(
			updateSiteSettings(site.id, accountId, {
				customDomain: "zdjecia.example.com",
			}),
		).rejects.toMatchObject({ status: 409 });
	});
});

describe("rotateEntryToken", () => {
	it("replaces the token and, for admin, invalidates every session", async () => {
		const { site, accountId } = await setup();
		const guest = await rotateEntryToken(site.id, accountId, "guest");
		expect(guest?.guest_entry_token).not.toBe(site.guest_entry_token);
		expect(guest?.admin_entry_token).toBe(site.admin_entry_token);
		expect(guest?.session_key_version).toBe(site.session_key_version);

		const admin = await rotateEntryToken(site.id, accountId, "admin");
		expect(admin?.admin_entry_token).not.toBe(site.admin_entry_token);
		expect(admin?.guest_entry_token).toBe(guest?.guest_entry_token);
		expect(admin?.session_key_version).toBe(site.session_key_version + 1);
	});
});
