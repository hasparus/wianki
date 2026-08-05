export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
			upload_batches: {
				Row: {
					id: string;
					guest_id: string;
					item_count: number;
					consent_version: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					guest_id: string;
					item_count: number;
					consent_version: string;
					created_at?: string;
				};
				Update: Partial<
					Database["public"]["Tables"]["upload_batches"]["Insert"]
				>;
				Relationships: [];
			};
			photos: {
				Row: {
					id: string;
					batch_id: string;
					guest_id: string;
					original_filename: string;
					original_content_type: string;
					original_size: number;
					derivative_content_type: string | null;
					derivative_size: number | null;
					width: number | null;
					height: number | null;
					storage_path: string;
					drive_file_id: string | null;
					hot_status: Database["public"]["Enums"]["hot_status"];
					archive_status: Database["public"]["Enums"]["archive_status"];
					moderation_status: Database["public"]["Enums"]["moderation_status"];
					moderation_scores: Json | null;
					last_error: string | null;
					decided_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					batch_id: string;
					guest_id: string;
					original_filename: string;
					original_content_type: string;
					original_size: number;
					derivative_content_type?: string | null;
					derivative_size?: number | null;
					width?: number | null;
					height?: number | null;
					storage_path: string;
					drive_file_id?: string | null;
					hot_status?: Database["public"]["Enums"]["hot_status"];
					archive_status?: Database["public"]["Enums"]["archive_status"];
					moderation_status?: Database["public"]["Enums"]["moderation_status"];
					moderation_scores?: Json | null;
					last_error?: string | null;
					decided_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
				Relationships: [
					{
						foreignKeyName: "photos_batch_id_fkey";
						columns: ["batch_id"];
						isOneToOne: false;
						referencedRelation: "upload_batches";
						referencedColumns: ["id"];
					},
				];
			};
			slideshow_slides: {
				Row: {
					id: string;
					position: number;
					kind: "photo" | "text";
					photo_id: string | null;
					title: string | null;
					subtitle: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					position: number;
					kind: "photo" | "text";
					photo_id?: string | null;
					title?: string | null;
					subtitle?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<
					Database["public"]["Tables"]["slideshow_slides"]["Insert"]
				>;
				Relationships: [
					{
						foreignKeyName: "slideshow_slides_photo_id_fkey";
						columns: ["photo_id"];
						isOneToOne: false;
						referencedRelation: "photos";
						referencedColumns: ["id"];
					},
				];
			};
			moderation_events: {
				Row: {
					id: number;
					photo_id: string;
					actor: string;
					action: string;
					details: Json | null;
					created_at: string;
				};
				Insert: {
					id?: never;
					photo_id: string;
					actor: string;
					action: string;
					details?: Json | null;
					created_at?: string;
				};
				Update: Partial<
					Database["public"]["Tables"]["moderation_events"]["Insert"]
				>;
				Relationships: [
					{
						foreignKeyName: "moderation_events_photo_id_fkey";
						columns: ["photo_id"];
						isOneToOne: false;
						referencedRelation: "photos";
						referencedColumns: ["id"];
					},
				];
			};
		};
		Views: Record<never, never>;
		Functions: Record<never, never>;
		Enums: {
			hot_status: "pending" | "uploaded" | "failed" | "deleted";
			archive_status:
				| "pending"
				| "uploaded"
				| "failed"
				| "trashed"
				| "deletion_error";
			moderation_status:
				| "pending"
				| "approved"
				| "flagged"
				| "review_required"
				| "rejected";
		};
		CompositeTypes: Record<never, never>;
	};
};
