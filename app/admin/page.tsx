import { getAdminPhotosPage } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
	await requireAdmin();
	return (
		<AdminClient
			initial={await getAdminPhotosPage()}
			archiveBackend={serverEnv().ARCHIVE_BACKEND}
		/>
	);
}
