import { z } from "zod";
import { hashPassphrase, randomToken, sha256Hex } from "@/lib/auth/secrets";
import { all, batch, first, nowIso, run } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import {
	rotateSiteSessions,
	SITE_COLUMNS,
	type Site,
	type SiteRow,
	toSite,
} from "@/lib/sites";

/**
 * Owner accounts and the sites they own. An account is an e-mail address and
 * nothing else: it logs in with a magic link, never a password. Every query
 * that touches a site is scoped by account_id, so a route handler that calls
 * into here with the session's account can never reach another couple's
 * wedding, whatever site id it was handed.
 */
export type Account = {
	id: string;
	email: string;
	created_at: string;
	last_login_at: string | null;
};

/** A validation or ownership problem the HTTP boundary can render as is. */
export class AccountError extends Error {
	readonly status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = "AccountError";
		this.status = status;
	}
}

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/;

/**
 * Subdomains the platform keeps for itself or that would confuse mail and
 * DNS. `demo` is deliberately not here so a demo wedding can live there.
 */
export const RESERVED_SLUGS = new Set([
	"www",
	"api",
	"admin",
	"konto",
	"app",
	"mail",
	"static",
	"assets",
	"cdn",
	"platform",
	"login",
	"pokaz",
	"cennik",
	"privacy",
	"ns1",
	"ns2",
	"smtp",
	"imap",
	"ftp",
	"webmail",
	"dev",
	"staging",
]);

const HOSTNAME_PATTERN =
	/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

const emailSchema = z
	.string()
	.trim()
	.max(254)
	.transform(normalizeEmail)
	.pipe(z.email("Podaj poprawny adres e-mail."));

const slugSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(
		SLUG_PATTERN,
		"Adres może mieć od 3 do 40 znaków: małe litery, cyfry i myślniki, bez myślnika na początku.",
	)
	.refine((slug) => !RESERVED_SLUGS.has(slug), "Ten adres jest zarezerwowany.");

const titleSchema = z
	.string()
	.trim()
	.min(1, "Podaj tytuł galerii.")
	.max(80, "Tytuł może mieć najwyżej 80 znaków.");

const guestPassphraseSchema = z
	.string()
	.min(4, "Hasło dla gości musi mieć co najmniej 4 znaki.")
	.max(200, "Hasło może mieć najwyżej 200 znaków.");

const adminPassphraseSchema = z
	.string()
	.min(8, "Hasło administratora musi mieć co najmniej 8 znaków.")
	.max(200, "Hasło może mieć najwyżej 200 znaków.");

const dateSchema = z
	.string()
	.trim()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Data musi mieć postać RRRR-MM-DD.")
	.refine(
		(value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
		"Podaj istniejącą datę.",
	);

const dateTimeSchema = z
	.string()
	.trim()
	.refine(
		(value) => !Number.isNaN(Date.parse(value)),
		"Podaj datę i godzinę w formacie ISO 8601.",
	)
	.transform((value) => new Date(value).toISOString());

const joinCodeSchema = z
	.string()
	.trim()
	.regex(
		/^[A-Za-z0-9_-]{4,64}$/,
		"Kod dołączenia może mieć od 4 do 64 znaków: litery, cyfry, myślniki.",
	);

const customDomainSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(HOSTNAME_PATTERN, "Podaj nazwę hosta, np. zdjecia.nasze-wesele.pl.");

export const createSiteSchema = z
	.object({
		slug: slugSchema,
		title: titleSchema,
		guestPassphrase: guestPassphraseSchema,
		adminPassphrase: adminPassphraseSchema,
		deletionContactEmail: emailSchema,
	})
	.refine((input) => input.guestPassphrase !== input.adminPassphrase, {
		path: ["adminPassphrase"],
		message: "Hasło administratora musi różnić się od hasła dla gości.",
	});

export type CreateSiteInput = z.input<typeof createSiteSchema>;

/**
 * Everything the owner may change after creation. Every key is optional and
 * only the keys present are written; `null` clears a nullable column.
 * Passphrases arrive in plain text and leave as PBKDF2 hashes.
 */
export const siteSettingsSchema = z.object({
	title: titleSchema.optional(),
	eventDate: dateSchema.nullable().optional(),
	guestPassphrase: guestPassphraseSchema.optional(),
	adminPassphrase: adminPassphraseSchema.optional(),
	guestJoinCode: joinCodeSchema.nullable().optional(),
	guestOpenUntil: dateTimeSchema.nullable().optional(),
	moderationEnabled: z.boolean().optional(),
	deletionContactEmail: emailSchema.nullable().optional(),
	customDomain: customDomainSchema.nullable().optional(),
});

export type SiteSettingsPatch = z.input<typeof siteSettingsSchema>;

function firstIssue(error: z.ZodError) {
	return error.issues[0]?.message ?? "Nieprawidłowe dane.";
}

function isUniqueViolation(error: unknown) {
	return error instanceof Error && /unique/i.test(error.message);
}

export async function findAccountByEmail(
	email: string,
): Promise<Account | null> {
	return first<Account>(
		"select id, email, created_at, last_login_at from accounts where email = ?",
		[normalizeEmail(email)],
	);
}

export async function findAccountById(id: string): Promise<Account | null> {
	return first<Account>(
		"select id, email, created_at, last_login_at from accounts where id = ?",
		[id],
	);
}

export async function findOrCreateAccount(email: string): Promise<Account> {
	const normalized = emailSchema.parse(email);
	const existing = await findAccountByEmail(normalized);
	if (existing) return existing;
	const id = crypto.randomUUID();
	await run(
		"insert into accounts (id, email) values (?, ?) on conflict (email) do nothing",
		[id, normalized],
	);
	const account = await findAccountByEmail(normalized);
	if (!account) throw new Error("Nie udało się utworzyć konta.");
	return account;
}

/**
 * A fresh magic-link token. Only its SHA-256 is stored; the token itself goes
 * into one e-mail. Issuing a new one retires every unused token of the same
 * address, so an old mail cannot be used after a newer one was requested.
 */
export async function issueLoginToken(email: string) {
	const normalized = emailSchema.parse(email);
	const token = randomToken(32);
	const now = nowIso();
	const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS).toISOString();
	await batch([
		{
			sql: "delete from login_tokens where email = ? and used_at is null",
			params: [normalized],
		},
		{
			sql: "delete from login_tokens where expires_at < ?",
			params: [now],
		},
		{
			sql: "insert into login_tokens (token_hash, email, expires_at) values (?, ?, ?)",
			params: [sha256Hex(token), normalized, expiresAt],
		},
	]);
	return { token, expiresAt };
}

/**
 * Single use: the row is marked used in the same statement that checks it
 * is unused and unexpired, so two concurrent clicks on one link cannot both
 * log in. Returns the account, created on first login.
 */
export async function consumeLoginToken(
	token: string | null | undefined,
): Promise<Account | null> {
	if (!token || token.length > 256) return null;
	const hash = sha256Hex(token);
	const now = nowIso();
	const changed = await run(
		"update login_tokens set used_at = ? where token_hash = ? and used_at is null and expires_at > ?",
		[now, hash, now],
	);
	if (changed !== 1) return null;
	const row = await first<{ email: string }>(
		"select email from login_tokens where token_hash = ?",
		[hash],
	);
	if (!row) return null;
	const account = await findOrCreateAccount(row.email);
	await run("update accounts set last_login_at = ? where id = ?", [
		now,
		account.id,
	]);
	return { ...account, last_login_at: now };
}

export async function listSitesForAccount(accountId: string): Promise<Site[]> {
	const rows = await all<SiteRow>(
		`select ${SITE_COLUMNS} from sites where account_id = ? order by created_at, id`,
		[accountId],
	);
	return rows.map((row) => toSite(row));
}

/** The site, only if this account owns it. Null otherwise, whatever the id. */
export async function requireOwnedSite(
	siteId: string,
	accountId: string,
): Promise<Site | null> {
	const row = await first<SiteRow>(
		`select ${SITE_COLUMNS} from sites where id = ? and account_id = ?`,
		[siteId, accountId],
	);
	return row ? toSite(row) : null;
}

export async function createSite(
	accountId: string,
	input: CreateSiteInput,
): Promise<Site> {
	const parsed = createSiteSchema.safeParse(input);
	if (!parsed.success) throw new AccountError(firstIssue(parsed.error));
	const data = parsed.data;

	const taken = await first<{ id: string }>(
		"select id from sites where slug = ?",
		[data.slug],
	);
	if (taken) throw new AccountError("Ten adres jest już zajęty.", 409);

	const id = crypto.randomUUID();
	const [guestHash, adminHash] = await Promise.all([
		hashPassphrase(data.guestPassphrase),
		hashPassphrase(data.adminPassphrase),
	]);
	try {
		await run(
			`insert into sites (id, account_id, slug, title, guest_passphrase_hash,
			   admin_passphrase_hash, guest_entry_token, admin_entry_token,
			   deletion_contact_email, consent_version)
			 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				accountId,
				data.slug,
				data.title,
				guestHash,
				adminHash,
				randomToken(32),
				randomToken(32),
				data.deletionContactEmail,
				serverEnv().CONSENT_VERSION,
			],
		);
	} catch (error) {
		if (isUniqueViolation(error))
			throw new AccountError("Ten adres jest już zajęty.", 409);
		throw error;
	}
	const site = await requireOwnedSite(id, accountId);
	if (!site) throw new Error("Nie udało się utworzyć galerii.");
	return site;
}

/**
 * A custom domain must be routed to the Worker by the owner; here we only
 * make sure it is a hostname and not one the platform already answers for.
 */
function assertCustomDomainAllowed(domain: string) {
	const platform = serverEnv().PLATFORM_HOST.toLowerCase().split(":")[0];
	if (domain === platform || domain.endsWith(`.${platform}`)) {
		throw new AccountError(
			`Adresy w domenie ${platform} są przydzielane automatycznie; wpisz własną domenę albo zostaw pole puste.`,
		);
	}
}

export async function updateSiteSettings(
	siteId: string,
	accountId: string,
	patch: SiteSettingsPatch,
): Promise<Site | null> {
	const owned = await requireOwnedSite(siteId, accountId);
	if (!owned) return null;
	const parsed = siteSettingsSchema.safeParse(patch);
	if (!parsed.success) throw new AccountError(firstIssue(parsed.error));
	const data = parsed.data;

	const sets: string[] = [];
	const params: (string | number | null)[] = [];
	const set = (column: string, value: string | number | null) => {
		sets.push(`${column} = ?`);
		params.push(value);
	};

	if (data.title !== undefined) set("title", data.title);
	if (data.eventDate !== undefined) set("event_date", data.eventDate);
	if (data.guestJoinCode !== undefined)
		set("guest_join_code", data.guestJoinCode);
	if (data.guestOpenUntil !== undefined)
		set("guest_open_until", data.guestOpenUntil);
	if (data.moderationEnabled !== undefined)
		set("moderation_enabled", data.moderationEnabled ? 1 : 0);
	if (data.deletionContactEmail !== undefined)
		set("deletion_contact_email", data.deletionContactEmail);
	if (data.customDomain !== undefined) {
		if (data.customDomain !== null)
			assertCustomDomainAllowed(data.customDomain);
		set("custom_domain", data.customDomain);
	}
	if (data.guestPassphrase !== undefined)
		set("guest_passphrase_hash", await hashPassphrase(data.guestPassphrase));
	if (data.adminPassphrase !== undefined)
		set("admin_passphrase_hash", await hashPassphrase(data.adminPassphrase));

	if (sets.length === 0) return owned;
	set("updated_at", nowIso());
	try {
		await run(
			`update sites set ${sets.join(", ")} where id = ? and account_id = ?`,
			[...params, siteId, accountId],
		);
	} catch (error) {
		if (isUniqueViolation(error))
			throw new AccountError(
				"Ta domena jest już przypisana do innej galerii.",
				409,
			);
		throw error;
	}
	return requireOwnedSite(siteId, accountId);
}

export type EntryTokenKind = "guest" | "admin";

/**
 * A new entry token retires the printed QR codes. Rotating the admin token
 * also bumps the site's session key, so every admin cookie minted from the
 * old QR stops verifying along with it.
 */
export async function rotateEntryToken(
	siteId: string,
	accountId: string,
	which: EntryTokenKind,
): Promise<Site | null> {
	const owned = await requireOwnedSite(siteId, accountId);
	if (!owned) return null;
	const column = which === "admin" ? "admin_entry_token" : "guest_entry_token";
	await run(
		`update sites set ${column} = ?, updated_at = ? where id = ? and account_id = ?`,
		[randomToken(32), nowIso(), siteId, accountId],
	);
	if (which === "admin") await rotateSiteSessions(siteId);
	return requireOwnedSite(siteId, accountId);
}

/** What the console may read back or embed: never a hash or an entry token. */
export function publicSiteSettings(site: Site) {
	return {
		id: site.id,
		slug: site.slug,
		title: site.title,
		origin: site.origin,
		eventDate: site.event_date,
		guestJoinCode: site.guest_join_code,
		guestOpenUntil: site.guest_open_until,
		moderationEnabled: site.moderationEnabled,
		deletionContactEmail: site.deletion_contact_email,
		customDomain: site.custom_domain,
		planStatus: site.plan_status,
	};
}

export type PublicSiteSettings = ReturnType<typeof publicSiteSettings>;

/** The two entry links the owner prints as QR codes. */
export function entryLinks(
	site: Pick<Site, "origin" | "guest_entry_token" | "admin_entry_token">,
) {
	return {
		guestUrl: `${site.origin}/?token=${encodeURIComponent(site.guest_entry_token)}`,
		adminUrl: `${site.origin}/admin?token=${encodeURIComponent(site.admin_entry_token)}`,
	};
}
