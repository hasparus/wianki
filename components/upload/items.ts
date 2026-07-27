import type { UploadItem } from "@/components/upload/types";

export type SelectionMerge = {
	kept: UploadItem[];
	droppedPreviewUrls: string[];
};

/**
 * A new file selection replaces everything still in flight or failed, but
 * successfully delivered photos stay visible so guests can keep track of what
 * they already sent before moderation approves it.
 */
export function retainDeliveredItems(current: UploadItem[]): SelectionMerge {
	const kept: UploadItem[] = [];
	const droppedPreviewUrls: string[] = [];
	for (const item of current) {
		if (item.phase === "done") {
			kept.push(item);
		} else if (item.previewUrl) {
			droppedPreviewUrls.push(item.previewUrl);
		}
	}
	return { kept, droppedPreviewUrls };
}
