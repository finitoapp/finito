import type { Currency } from "@/lib/types";

export type CurrencyConverterDriver = {
	convert: (props: {
		amount: number;
		sourceCurrency: Currency;
		targetCurrency: Currency;
	}) => Promise<number | null>;
};
