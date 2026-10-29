import { describe, expect, it } from "vitest";
import {
	createAdminSession,
	createGuestSession,
	createOwnerSession,
	readAdminSession,
	readGuestSession,
	readOwnerSession,
} from "@/lib/auth/session";
import { run } from "@/lib/db";
import { findSiteById, type Site, targetFromHost } from "@/lib/sites";
import { setupSite } from "./helpers/site";

describe("host resolution", () => {
	it("maps the platform host, a slug subdomain and a custom domain", () => {
		expect(targetFromHost("wianki.app", "wianki.app")).toEqual({
			kind: "platform",
		});
		expect(targetFromHost("Rosia.wianki.app:443", "wianki.app")).toEqual({
			kind: "slug",
			slug: "rosia",
		});
		expect(targetFromHost("a.b.wianki.app", "wianki.app")).toEqual({
			kind: "platform",
		});
		expect(targetFromHost("wesele.example.com", "wianki.app")).toEqual({
			kind: "domain",
			domain: "wesele.example.com",
		});
		expect(targetFromHost("localhost:3000", "platform.localhost")).toEqual({
			kind: "domain",
			domain: "localhost",
		});
		expect(targetFromHost(null, "wianki.app")).toEqual({ kind: "platform" });
	});
});

describe("site sessions", () => {
	it("derives a site's origin from the platform host or its custom domain", async () => {
		const { site } = await setupSite({ slug: "rosia" });
		expect(site.origin).toBe("https://rosia.wianki.test");
		await run(
			"update sites set custom_domain = 'wesele.example.com' where id = ?",
			[site.id],
		);
		expect((await findSiteById(site.id))?.origin).toBe(
			"https://wesele.example.com",
		);
	});

	it("does not accept one site's cookie on another site", async () => {
		const { site } = await setupSite();
		const other: Site = { ...site, id: "99999999-9999-4999-8999-999999999999" };
		const token = await createGuestSession(site, "g-1");
		expect(await readGuestSession(site, token)).toMatchObject({
			guestId: "g-1",
		});
		expect(await readGuestSession(other, token)).toBeNull();
		expect(await readAdminSession(site, token)).toBeNull();
	});

	it("invalidates every cookie when the site's key version is bumped", async () => {
		const { site } = await setupSite();
		const admin = await createAdminSession(site);
		expect(await readAdminSession(site, admin)).not.toBeNull();
		const rotated = {
			...site,
			session_key_version: site.session_key_version + 1,
		};
		expect(await readAdminSession(rotated, admin)).toBeNull();
	});

	it("keeps owner sessions separate from site sessions", async () => {
		const { site } = await setupSite();
		const owner = await createOwnerSession("acc-1");
		expect(await readOwnerSession(owner)).toEqual({
			role: "owner",
			accountId: "acc-1",
		});
		expect(await readGuestSession(site, owner)).toBeNull();
	});
});
