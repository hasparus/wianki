import { getAdminQueue } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/session";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
	await requireAdmin();
	return <AdminClient initial={await getAdminQueue()} />;
}
