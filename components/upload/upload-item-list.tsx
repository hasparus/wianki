import Image from "next/image";
import { phaseLabel } from "@/components/upload/messages";
import type { UploadItem } from "@/components/upload/types";

export function UploadItemList({ items }: { items: UploadItem[] }) {
	if (!items.length) return null;
	return (
		<ul
			className="mt-8 divide-y divide-ma-ash border-y border-ma-ash"
			aria-live="polite"
		>
			{items.map((item) => (
				<li key={item.id} className="flex items-center gap-4 py-3">
					{item.previewUrl ? (
						<Image
							src={item.previewUrl}
							alt=""
							width={56}
							height={56}
							unoptimized
							className="size-14 shrink-0 object-cover"
						/>
					) : (
						<span aria-hidden className="size-14 shrink-0 bg-ma-ash" />
					)}
					<div className="min-w-0 grow">
						<div className="flex items-baseline justify-between gap-4">
							<span className="min-w-0 truncate text-sm">{item.file.name}</span>
							<span className="ma-label shrink-0">
								{phaseLabel(item.phase)}
							</span>
						</div>
						{item.phase === "uploading" ? (
							<div
								role="progressbar"
								aria-valuenow={Math.round((item.progress ?? 0) * 100)}
								aria-valuemin={0}
								aria-valuemax={100}
								className="mt-2 h-px w-full bg-ma-ash"
							>
								<div
									className="h-px bg-ma-ink transition-[width] duration-300"
									style={{ width: `${(item.progress ?? 0) * 100}%` }}
								/>
							</div>
						) : null}
						{item.message ? (
							<p
								className={`mt-1 text-sm ${
									item.phase === "failed" || item.phase === "archive_failed"
										? "text-ma-oxblood"
										: "text-ma-pine"
								}`}
							>
								{item.message}
							</p>
						) : null}
					</div>
				</li>
			))}
		</ul>
	);
}
