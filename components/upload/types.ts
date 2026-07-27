import type { ModerationStatus } from "@/lib/domain";

export type UploadPhase =
	| "queued"
	| "compressing"
	| "uploading"
	| "archive_failed"
	| "done"
	| "failed";

export type UploadItem = {
	id: string;
	file: File;
	phase: UploadPhase;
	message: string;
	photoId?: string;
};

export type InitUpload = {
	photoId: string;
	path: string;
	uploadToken: string;
	archiveToken: string;
};

export type FinalizeResult = {
	warning?: string | null;
	moderationStatus: ModerationStatus;
};

export type UploadJob =
	| { kind: "fresh"; item: UploadItem; init: InitUpload }
	| { kind: "archive_retry"; item: UploadItem };

export type UploadFileMetadata = Pick<File, "name" | "size" | "type">;
