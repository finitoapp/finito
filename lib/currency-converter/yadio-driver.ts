import { BigNumber } from "bignumber.js";
import { z } from "zod";
import type { CurrencyConverterDriver } from "@/lib/currency-converter/currency-converter-types";
import { Integer } from "@/lib/types";
import { currencyFractionDigits } from "@/lib/zod/moneyCodec";

export const createYadioDriver = ({
	cacheInSeconds,
}: {
	cacheInSeconds: number;
}) => {
	const cache = new Map<string, number | null>();

	const getCurrentRate = async (
		props: Parameters<CurrencyConverterDriver["convert"]>[0],
	) => {
		const url = `https://api.yadio.io/convert/1/${props.sourceCurrency}/${props.targetCurrency}`;
		try {
			const response = await fetch(url);
			if (!response.ok) {
				console.error(new Error(`HTTP error! status: ${response.status}`));
				return null;
			}

			const data = await response.json();
			return z.number().parse(data.result);
		} catch (error) {
			console.error("Error fetching conversion rate:", error);
			return null;
		}
	};

	const yadioDriver: CurrencyConverterDriver = {
		convert: async (props) => {
			const cacheKey = `${props.sourceCurrency}/${props.targetCurrency}`;
			let rate = cache.get(cacheKey);
			if (rate === undefined) {
				rate = await getCurrentRate(props);
				cache.set(cacheKey, rate);
				setTimeout(() => {
					cache.delete(cacheKey);
				}, cacheInSeconds * 1000);
			}

			if (rate === null) {
				return null;
			}

			return Integer(
				new BigNumber(rate)
					.times(
						new BigNumber(props.amount).shiftedBy(
							-currencyFractionDigits[props.sourceCurrency],
						),
					)
					.shiftedBy(currencyFractionDigits[props.targetCurrency])
					.integerValue()
					.toNumber(),
			);
		},
	};

	return yadioDriver;
};
