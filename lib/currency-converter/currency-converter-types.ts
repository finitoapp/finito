import type { Currency } from "@/lib/types";

export type CurrencyConverterDriver = {
	convert: (props: {
		amount: Integer;
		sourceCurrency: Currency;
		targetCurrency: Currency;
	}) => Promise<Integer | null>;
};
