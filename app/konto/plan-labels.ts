/** Plan states in the owner's words. Pure so client components can import it. */
export const PLAN_STATUS_LABELS = {
	trial: "Wersja próbna",
	active: "Opłacona",
	past_due: "Zaległa płatność",
	canceled: "Anulowana",
} as const;

export type PlanStatus = keyof typeof PLAN_STATUS_LABELS;

export function planStatusLabel(status: string) {
	return PLAN_STATUS_LABELS[status as PlanStatus] ?? PLAN_STATUS_LABELS.trial;
}

export function formatGb(value: number) {
	return `${value.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} GB`;
}

export function formatUsd(value: number) {
	return `${value.toLocaleString("pl-PL")} $`;
}
