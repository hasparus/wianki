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

export function formatGalleryStats(
	contributingGuests: number,
	approvedPhotos: number,
): string {
	if (approvedPhotos === 0) return "";
	const guests = declinePolish(contributingGuests, {
		one: "gość",
		few: "gości",
		many: "gości",
		other: "gościa",
	});
	const added = declinePolish(contributingGuests, {
		one: "dodał",
		few: "dodało",
		many: "dodało",
		other: "dodało",
	});
	const photos = declinePolish(approvedPhotos, {
		one: "zdjęcie",
		few: "zdjęcia",
		many: "zdjęć",
		other: "zdjęcia",
	});

	return `${contributingGuests} ${guests} ${added} już ${approvedPhotos} ${photos}`;
}
