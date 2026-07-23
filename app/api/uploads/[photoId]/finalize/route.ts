import { z } from "zod";
import { readGuestSession } from "@/lib/auth/session";
import { verifyArchiveReceipt } from "@/lib/archive-token";
import { GALLERY_BUCKET, MAX_DERIVATIVE_BYTES } from "@/lib/domain";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { moderateImage } from "@/lib/moderation";
import { supabaseAdmin } from "@/lib/supabase/server";

const bodySchema = z.object({
  archiveReceipt: z.string().min(1).nullable(),
  archiveError: z.string().max(500).nullable().optional(),
  derivativeSize: z.number().int().positive().max(MAX_DERIVATIVE_BYTES),
  derivativeType: z.enum(["image/webp", "image/jpeg"]),
  width: z.number().int().positive().max(20_000),
  height: z.number().int().positive().max(20_000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const session = await readGuestSession();
  if (!session) return jsonError("Sesja gościa wygasła.", 401);
  try {
    assertSameOrigin(request);
  } catch (response) {
    return response as Response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Nieprawidłowe potwierdzenie zdjęcia.", 400);
  const { photoId } = await params;
  const supabase = supabaseAdmin();
  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("id,storage_path,original_size")
    .eq("id", photoId)
    .eq("guest_id", session.guestId)
    .single();
  if (photoError || !photo) return jsonError("Nie znaleziono zdjęcia.", 404);

  const { data: image, error: downloadError } = await supabase.storage
    .from(GALLERY_BUCKET)
    .download(photo.storage_path as string);
  if (downloadError || !image || image.size > MAX_DERIVATIVE_BYTES) {
    await supabase
      .from("photos")
      .update({ hot_status: "failed", last_error: "Nieprawidłowa kopia galeryjna." })
      .eq("id", photoId);
    return jsonError("Nie udało się zweryfikować kopii galeryjnej.", 400);
  }

  let driveFileId: string | null = null;
  let archiveStatus = "failed";
  let archiveError = parsed.data.archiveError ?? null;
  if (parsed.data.archiveReceipt) {
    try {
      const receipt = await verifyArchiveReceipt(parsed.data.archiveReceipt);
      if (
        receipt.photoId !== photoId ||
        receipt.size !== Number(photo.original_size)
      ) {
        throw new Error("Potwierdzenie dotyczy innego zdjęcia.");
      }
      driveFileId = receipt.driveFileId;
      archiveStatus = "uploaded";
      archiveError = null;
    } catch (error) {
      archiveError =
        error instanceof Error ? error.message : "Błędne potwierdzenie archiwum.";
    }
  }

  let moderationStatus = "review_required";
  let moderationScores: Record<string, string | undefined> | null = null;
  let moderationError: string | null = null;
  try {
    const moderation = await moderateImage(image);
    moderationStatus = moderation.status;
    moderationScores = moderation.scores;
  } catch (error) {
    moderationError =
      error instanceof Error ? error.message : "Nie udało się sprawdzić zdjęcia.";
  }

  const lastError = [archiveError, moderationError].filter(Boolean).join(" | ") || null;
  const { error: updateError } = await supabase
    .from("photos")
    .update({
      hot_status: "uploaded",
      archive_status: archiveStatus,
      moderation_status: moderationStatus,
      drive_file_id: driveFileId,
      derivative_size: parsed.data.derivativeSize,
      derivative_content_type: parsed.data.derivativeType,
      width: parsed.data.width,
      height: parsed.data.height,
      moderation_scores: moderationScores,
      last_error: lastError,
    })
    .eq("id", photoId);
  if (updateError) return jsonError("Nie udało się zapisać wyniku zdjęcia.", 500);

  await supabase.from("moderation_events").insert({
    photo_id: photoId,
    actor: moderationScores ? "vision" : "system",
    action: moderationStatus,
    details: moderationScores ?? { error: moderationError },
  });

  return noStoreJson({
    ok: true,
    archiveStatus,
    moderationStatus,
    warning: lastError,
  });
}
