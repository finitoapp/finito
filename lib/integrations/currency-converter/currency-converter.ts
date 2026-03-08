import type { CurrencyConverterDriver } from "@/lib/integrations/currency-converter/currency-converter-types";
import { createYadioDriver } from "@/lib/integrations/currency-converter/yadio-driver";
import type { Integer } from "@/lib/shared/types";

const drivers: CurrencyConverterDriver[] = [
	createYadioDriver({ cacheInSeconds: 20 }),
];

export const currencyConverter = {
	convert: async (
		props: Parameters<CurrencyConverterDriver["convert"]>[0],
	): Promise<Integer | null> => {
		for (const driver of drivers) {
			const result = await driver.convert(props);
			if (result !== null) {
				return result;
			}
		}

		return null;
	},
};
