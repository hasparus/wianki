import { GalleryClient } from "@/components/gallery-client";
import { requireGuest } from "@/lib/auth/session";
import { getGalleryPage, getGalleryStats } from "@/lib/gallery";

export default async function Home() {
  await requireGuest();
  const [page, stats] = await Promise.all([getGalleryPage(), getGalleryStats()]);
  return <GalleryClient initial={{ ...page, stats }} />;
}
