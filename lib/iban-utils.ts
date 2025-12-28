import type { Iban } from "@/lib/types";

export const parseCzechBankAccountFromIban = (iban: Iban): string | null => {
	if (!iban.startsWith("CZ")) {
		return null;
	}

	return `${iban.slice(8, 14)}-${iban.slice(14, 25)}/${iban.slice(4, 8)}`.replace(
		/^[0-]+/,
		"",
	);
};
