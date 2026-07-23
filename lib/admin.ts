import { GALLERY_BUCKET } from "@/lib/domain";
import { supabaseAdmin } from "@/lib/supabase/server";

export type AdminPhoto = {
  id: string;
  imageUrl: string | null;
  originalFilename: string;
  hotStatus: string;
  archiveStatus: string;
  moderationStatus: string;
  lastError: string | null;
  createdAt: string;
};

type AdminRow = {
  id: string;
  storage_path: string;
  original_filename: string;
  hot_status: string;
  archive_status: string;
  moderation_status: string;
  last_error: string | null;
  created_at: string;
};

export async function getAdminQueue() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("photos")
    .select(
      "id,storage_path,original_filename,hot_status,archive_status,moderation_status,last_error,created_at",
    )
    .or(
      "moderation_status.in.(pending,flagged,review_required,rejected),archive_status.in.(failed,deletion_error)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return Promise.all(
    ((data ?? []) as AdminRow[]).map(async (row): Promise<AdminPhoto> => {
      let imageUrl: string | null = null;
      if (row.hot_status === "uploaded") {
        const { data: signed } = await supabase.storage
          .from(GALLERY_BUCKET)
          .createSignedUrl(row.storage_path, 60 * 30);
        imageUrl = signed?.signedUrl ?? null;
      }
      return {
        id: row.id,
        imageUrl,
        originalFilename: row.original_filename,
        hotStatus: row.hot_status,
        archiveStatus: row.archive_status,
        moderationStatus: row.moderation_status,
        lastError: row.last_error,
        createdAt: row.created_at,
      };
    }),
  );
}
