import type { Currency } from "@/lib/shared/types";

export type CurrencyConverterDriver = {
	convert: (props: {
		amount: Integer;
		sourceCurrency: Currency;
		targetCurrency: Currency;
	}) => Promise<Integer | null>;
};
