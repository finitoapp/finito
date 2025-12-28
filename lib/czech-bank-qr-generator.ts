import type { Currency, Iban } from "@/lib/types";

export const generateCzechBankQrCode = (data: {
	iban: Iban;
	currency: Currency;
	amount: number;
	variableSymbol?: string;
	specificSymbol?: string;
	title?: string;
	message?: string;
	recipientName?: string;
	useInstantPayment?: boolean;
}) => {
	if (data.amount < 0.01 || data.amount > 999999999.99) {
		throw new Error("data.amount must be >=0.01 and <=999999999.99.");
	}

	const values: string[] = [
		"SPD",
		"1.0",
		`ACC:${data.iban}`,
		`AM:${data.amount.toFixed(2)}`,
		`CC:${data.currency}`,
	];

	if (data.title) {
		values.push(`RF:${data.title}`);
	}

	if (data.recipientName) {
		values.push(`RN:${data.recipientName}`);
	}

	if (data.variableSymbol) {
		values.push(`X-VS:${data.variableSymbol}`);
	}

	if (data.specificSymbol) {
		values.push(`X-SS:${data.specificSymbol}`);
	}

	if (data.message) {
		values.push(`MSG:${data.message}`);
	}

	if (data.useInstantPayment) {
		values.push(`PT:IP`);
	}

	return values.join("*");
};
