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
