import type { Iban } from "@/lib/shared/types";
import { type Money, minorUnitsToDecimalString } from "@/lib/shared/zod/money-codec";

export function formatAmount(
	amount: number,
	currency?: string | undefined,
	locale: string = "en-US",
) {
	const normalizedCurrency = currency ? currency.toUpperCase() : undefined;
	if (normalizedCurrency && ["BTC"].includes(normalizedCurrency)) {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currencyDisplay: "code",
			currency: "USD", // Use USD as base but replace symbol
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		})
			.format(amount * 100000000)
			.replace("USD", "Sats");
	}

	try {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency: currency ? currency.toUpperCase() : undefined,
			minimumFractionDigits: 2,
		}).format(amount);
	} catch (_error) {
		return `${amount.toLocaleString()}${currency ? ` ${currency.toUpperCase()}` : ""}`;
	}
}

export function formatMoney(money: Money, locale: string = "en-US") {
	const value = minorUnitsToDecimalString(money);
	return formatAmount(Number(value), money.currency, locale);
}

export function formatIban(iban: Iban) {
	return iban.replace(/(.{4})/g, "$1\u00A0");
}

export function formatPostalCode(postalCode: string) {
	return postalCode.replace(/(.{3})/g, "$1\u00A0");
}
