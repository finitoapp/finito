import type { CurrencyConverterDriver } from "@/lib/currency-converter/currency-converter-types";
import { createYadioDriver } from "@/lib/currency-converter/yadio-driver";

const drivers: CurrencyConverterDriver[] = [
	createYadioDriver({ cacheInSeconds: 20 }),
];

export const currencyConverter = {
	convert: async (
		props: Parameters<CurrencyConverterDriver["convert"]>[0],
	): Promise<number | null> => {
		for (const driver of drivers) {
			const result = await driver.convert(props);
			if (result !== null) {
				return result;
			}
		}

		return null;
	},
};
