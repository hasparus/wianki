import { getAdminPhotosPage } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/session";
import { requireSite } from "@/lib/sites";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
	const site = await requireSite();
	await requireAdmin(site);
	return (
		<AdminClient
			initial={await getAdminPhotosPage(site.id)}
			archiveBackend="r2"
		/>
	);
}
