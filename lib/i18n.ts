const polishCardinalRules = new Intl.PluralRules("pl");

type PolishDeclension = {
	one: string;
	few: string;
	many: string;
	other: string;
};

export function declinePolish(count: number, forms: PolishDeclension): string {
	const category = polishCardinalRules.select(count);

	if (category === "one" || category === "few" || category === "many") {
		return forms[category];
	}

	return forms.other;
}

const guestForms: PolishDeclension = {
	one: "gość",
	few: "gości",
	many: "gości",
	other: "gościa",
};

const addedForms: PolishDeclension = {
	one: "dodał",
	few: "dodało",
	many: "dodało",
	other: "dodało",
};

const photoForms: PolishDeclension = {
	one: "zdjęcie",
	few: "zdjęcia",
	many: "zdjęć",
	other: "zdjęcia",
};

/**
 * The gallery prints its counts as struck numerals with a noun beneath them, so
 * the noun has to decline on its own as well as inside the sentence. Both read
 * from the same forms, so the label and the sentence cannot drift apart.
 */
export function photoCountNoun(approvedPhotos: number): string {
	return declinePolish(approvedPhotos, photoForms);
}

export function guestCountNoun(contributingGuests: number): string {
	return declinePolish(contributingGuests, guestForms);
}

export function formatGalleryStats(
	contributingGuests: number,
	approvedPhotos: number,
): string {
	if (approvedPhotos === 0) return "";
	const added = declinePolish(contributingGuests, addedForms);

	return `${contributingGuests} ${guestCountNoun(contributingGuests)} ${added} już ${approvedPhotos} ${photoCountNoun(approvedPhotos)}`;
}
