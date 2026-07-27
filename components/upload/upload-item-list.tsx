import Image from "next/image";
import { phaseLabel } from "@/components/upload/messages";
import type { UploadItem } from "@/components/upload/types";

export function UploadItemList({ items }: { items: UploadItem[] }) {
	if (!items.length) return null;
	return (
		<ul className="mt-5 grid gap-3" aria-live="polite">
			{items.map((item) => (
				<li
					key={item.id}
					className="flex items-center gap-3 rounded-2xl bg-white/75 px-4 py-3"
				>
					{item.previewUrl ? (
						<Image
							src={item.previewUrl}
							alt=""
							width={48}
							height={48}
							unoptimized
							className="size-12 shrink-0 rounded-xl object-cover"
						/>
					) : null}
					<div className="min-w-0 grow">
						<div className="flex items-center justify-between gap-3">
							<span className="min-w-0 truncate font-semibold">
								{item.file.name}
							</span>
							<span className="shrink-0 text-sm">{phaseLabel(item.phase)}</span>
						</div>
						{item.phase === "uploading" ? (
							<div
								role="progressbar"
								aria-valuenow={Math.round((item.progress ?? 0) * 100)}
								aria-valuemin={0}
								aria-valuemax={100}
								className="mt-2 h-1.5 overflow-hidden rounded-full bg-wedding-rose/40"
							>
								<div
									className="h-full rounded-full bg-wedding-green transition-[width] duration-300"
									style={{ width: `${(item.progress ?? 0) * 100}%` }}
								/>
							</div>
						) : null}
						{item.message ? (
							<p className="mt-1 text-sm">{item.message}</p>
						) : null}
					</div>
				</li>
			))}
		</ul>
	);
}
