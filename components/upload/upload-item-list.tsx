import { phaseLabel } from "@/components/upload/messages";
import type { UploadItem } from "@/components/upload/types";

export function UploadItemList({ items }: { items: UploadItem[] }) {
	if (!items.length) return null;
	return (
		<ul className="mt-5 grid gap-3" aria-live="polite">
			{items.map((item) => (
				<li key={item.id} className="rounded-2xl bg-white/75 px-4 py-3">
					<div className="flex items-center justify-between gap-3">
						<span className="min-w-0 truncate font-semibold">
							{item.file.name}
						</span>
						<span className="shrink-0 text-sm">{phaseLabel(item.phase)}</span>
					</div>
					{item.message ? <p className="mt-1 text-sm">{item.message}</p> : null}
				</li>
			))}
		</ul>
	);
}
