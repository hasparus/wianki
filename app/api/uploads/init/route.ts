import { z } from "zod";
import { createArchiveToken } from "@/lib/archive-token";
import {
  acceptedOriginalTypes,
  GALLERY_BUCKET,
  MAX_BATCH_FILES,
  MAX_ORIGINAL_BYTES,
} from "@/lib/domain";
import { serverEnv } from "@/lib/env";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { readGuestSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";

const fileSchema = z.object({
  name: z.string().min(1).max(180),
  type: z.enum(acceptedOriginalTypes),
  size: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
});

const requestSchema = z.object({
  consent: z.literal(true),
  files: z.array(fileSchema).min(1).max(MAX_BATCH_FILES),
});

function safeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 120) || "zdjecie";
}

export async function POST(request: Request) {
  const session = await readGuestSession();
  if (!session) return jsonError("Sesja gościa wygasła.", 401);
  try {
    assertSameOrigin(request);
  } catch (response) {
    return response as Response;
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Wybierz od 1 do 10 obsługiwanych zdjęć.", 400);
  }

  const supabase = supabaseAdmin();
  const batchId = crypto.randomUUID();
  const rows = parsed.data.files.map((file) => {
    const id = crypto.randomUUID();
    return {
      id,
      batch_id: batchId,
      guest_id: session.guestId,
      original_filename: safeFilename(file.name),
      original_content_type: file.type,
      original_size: file.size,
      storage_path: `${batchId}/${id}.webp`,
    };
  });

  const { error: batchError } = await supabase.from("upload_batches").insert({
    id: batchId,
    guest_id: session.guestId,
    item_count: rows.length,
    consent_version: serverEnv().CONSENT_VERSION,
  });
  if (batchError) return jsonError("Nie udało się rozpocząć wysyłania.", 500);

  const { error: photoError } = await supabase.from("photos").insert(rows);
  if (photoError) {
    await supabase.from("upload_batches").delete().eq("id", batchId);
    return jsonError("Nie udało się przygotować zdjęć.", 500);
  }

  try {
    const uploads = await Promise.all(
      rows.map(async (row, index) => {
        const { data, error } = await supabase.storage
          .from(GALLERY_BUCKET)
          .createSignedUploadUrl(row.storage_path);
        if (error) throw error;
        return {
          photoId: row.id,
          path: row.storage_path,
          uploadToken: data.token,
          archiveToken: await createArchiveToken({
            photoId: row.id,
            operation: "upload",
            filename: `${row.id}__${row.original_filename}`,
            contentType: parsed.data.files[index].type,
            size: parsed.data.files[index].size,
          }),
        };
      }),
    );
    return noStoreJson({ batchId, uploads });
  } catch {
    await supabase.from("photos").delete().eq("batch_id", batchId);
    await supabase.from("upload_batches").delete().eq("id", batchId);
    return jsonError("Nie udało się utworzyć bezpiecznych adresów wysyłki.", 500);
  }
}
