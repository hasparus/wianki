import Image from "next/image";
import { type PointerEvent, useState } from "react";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	GripIcon,
	XIcon,
} from "@/components/slideshow/icons";
import type { AdminSlide } from "@/lib/slideshow";
import {
	SLIDESHOW_MAX_SUBTITLE,
	SLIDESHOW_MAX_TITLE,
} from "@/lib/slideshow-protocol";

function SlideText({ slide }: { slide: AdminSlide }) {
	if (slide.kind === "photo") {
		return slide.photoVisible ? (
			<p className="truncate text-sm text-wedding-green-soft">
				Zdjęcie z galerii
			</p>
		) : (
			<p className="text-sm font-bold text-wedding-warning">
				Zdjęcie niewidoczne — pominięte w pokazie
			</p>
		);
	}
	return (
		<>
			<p className="truncate font-bold">{slide.title}</p>
			{slide.subtitle ? (
				<p className="truncate text-sm">{slide.subtitle}</p>
			) : null}
		</>
	);
}

/** Mounted only while a text slide is being edited, so it seeds its own draft. */
function EditForm({
	slide,
	pending,
	onSave,
	onCancel,
}: {
	slide: AdminSlide;
	pending: boolean;
	onSave: (title: string, subtitle: string) => void;
	onCancel: () => void;
}) {
	const [title, setTitle] = useState(slide.title ?? "");
	const [subtitle, setSubtitle] = useState(slide.subtitle ?? "");

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSave(title, subtitle);
	}

	return (
		<form onSubmit={submit} className="grid gap-2">
			<input
				value={title}
				onChange={(event) => setTitle(event.target.value)}
				required
				maxLength={SLIDESHOW_MAX_TITLE}
				aria-label="Tytuł slajdu"
				className="min-h-10 w-full rounded-xl border border-wedding-green bg-white px-3"
			/>
			<input
				value={subtitle}
				onChange={(event) => setSubtitle(event.target.value)}
				maxLength={SLIDESHOW_MAX_SUBTITLE}
				aria-label="Podtytuł slajdu"
				placeholder="Podtytuł (opcjonalnie)"
				className="min-h-10 w-full rounded-xl border border-wedding-green/50 bg-white px-3"
			/>
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={pending}
					className="min-h-10 rounded-full bg-wedding-green px-4 text-sm font-bold text-wedding-rose disabled:opacity-50"
				>
					Zapisz
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="min-h-10 rounded-full border border-wedding-green px-4 text-sm font-bold"
				>
					Anuluj
				</button>
			</div>
		</form>
	);
}

export function SlideRow({
	slide,
	index,
	total,
	dragging,
	editing,
	pending,
	registerRow,
	onDragStart,
	onMove,
	onRemove,
	onStartEdit,
	onSaveEdit,
	onCancelEdit,
}: {
	slide: AdminSlide;
	index: number;
	total: number;
	dragging: boolean;
	editing: boolean;
	pending: boolean;
	registerRow: (slideId: string, element: HTMLLIElement | null) => void;
	onDragStart: (event: PointerEvent, slideId: string) => void;
	onMove: (from: number, to: number) => void;
	onRemove: (slideId: string) => void;
	onStartEdit: (slideId: string) => void;
	onSaveEdit: (slideId: string, title: string, subtitle: string) => void;
	onCancelEdit: () => void;
}) {
	return (
		<li
			ref={(element) => registerRow(slide.id, element)}
			className={`flex items-center gap-3 rounded-3xl border bg-wedding-cream p-3 shadow-sm ${
				dragging
					? "relative z-10 scale-[1.01] border-wedding-green shadow-lg"
					: "border-wedding-rose"
			}`}
		>
			<span
				aria-hidden
				onPointerDown={(event) => onDragStart(event, slide.id)}
				className="shrink-0 cursor-grab touch-none select-none px-1.5 py-3 text-xl leading-none text-wedding-green/60 active:cursor-grabbing"
			>
				<GripIcon />
			</span>
			<span className="w-6 shrink-0 text-center font-serif text-xl font-bold">
				{index + 1}
			</span>
			{slide.kind === "photo" ? (
				slide.imageUrl ? (
					<Image
						src={slide.imageUrl}
						alt=""
						width={160}
						height={120}
						unoptimized
						draggable={false}
						className="h-16 w-20 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-28"
					/>
				) : (
					<div className="grid h-16 w-20 shrink-0 place-items-center rounded-2xl bg-wedding-rose/30 px-2 text-center text-xs font-bold sm:h-20 sm:w-28">
						Zdjęcie ukryte
					</div>
				)
			) : (
				<div className="grid h-16 w-20 shrink-0 place-items-center rounded-2xl bg-wedding-green px-2 text-center sm:h-20 sm:w-28">
					<span className="font-serif text-xs font-bold text-wedding-ivory">
						Aa
					</span>
				</div>
			)}
			<div className="min-w-0 flex-1">
				{editing ? (
					<EditForm
						slide={slide}
						pending={pending}
						onSave={(title, subtitle) => onSaveEdit(slide.id, title, subtitle)}
						onCancel={onCancelEdit}
					/>
				) : (
					<>
						<SlideText slide={slide} />
						{slide.kind === "text" ? (
							<button
								type="button"
								onClick={() => onStartEdit(slide.id)}
								className="mt-1 text-sm font-bold underline underline-offset-4 hover:text-wedding-green-soft"
							>
								Edytuj treść
							</button>
						) : null}
					</>
				)}
			</div>
			<div className="flex shrink-0 flex-col items-center gap-1.5 sm:flex-row">
				<button
					type="button"
					onClick={() => onMove(index, index - 1)}
					disabled={pending || index === 0}
					aria-label="Przesuń wyżej"
					className="grid min-h-10 min-w-10 place-items-center rounded-full border border-wedding-green hover:bg-wedding-rose/40 disabled:opacity-40"
				>
					<ArrowUpIcon />
				</button>
				<button
					type="button"
					onClick={() => onMove(index, index + 1)}
					disabled={pending || index === total - 1}
					aria-label="Przesuń niżej"
					className="grid min-h-10 min-w-10 place-items-center rounded-full border border-wedding-green hover:bg-wedding-rose/40 disabled:opacity-40"
				>
					<ArrowDownIcon />
				</button>
				<button
					type="button"
					onClick={() => onRemove(slide.id)}
					disabled={pending}
					aria-label="Usuń slajd"
					className="grid min-h-10 min-w-10 place-items-center rounded-full bg-wedding-error text-white disabled:opacity-40"
				>
					<XIcon />
				</button>
			</div>
		</li>
	);
}
