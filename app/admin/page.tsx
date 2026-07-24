import { AdminClient } from "./admin-client";
import { getAdminQueue } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminPage() {
  await requireAdmin();
  return <AdminClient initial={await getAdminQueue()} />;
}
