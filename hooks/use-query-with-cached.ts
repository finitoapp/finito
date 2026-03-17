import {
	type DefaultError,
	type UndefinedInitialDataOptions,
	type UseQueryResult,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import {
	type CacheValue,
	getCachedValue,
	setCachedValue,
} from "@/lib/cache/key-value-cache";
import { stableStringify } from "@/lib/shared/utils/json";

const emptyValue = Symbol("emptyValue");

export const useQueryWithCached = <
	TQueryFnData = CacheValue,
	TError = DefaultError,
	TData extends TQueryFnData = TQueryFnData,
	TQueryKey extends string = string,
>(
	options: Omit<
		UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey[]>,
		"queryKey"
	> & {
		queryKey: TQueryKey;
	},
): UseQueryResult<NoInfer<TData>, TError> => {
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const cacheQuery = useMemo(
		() => async () => {
			return (
				(await getCachedValue({ deviceEvolu })(options.queryKey)) ?? emptyValue
			);
		},
		[deviceEvolu, options.queryKey],
	);
	const { data: cachedData } = useSuspenseQuery({
		queryKey: [`cache:${options.queryKey}`],
		queryFn: cacheQuery,
	});

	const { data, ...rest } = useQuery({
		refetchOnMount: "always",
		...options,
		queryKey: [options.queryKey],
	});

	useEffect(() => {
		if (data === undefined) {
			return;
		}

		if (
			cachedData === emptyValue ||
			stableStringify(data) !== stableStringify(cachedData)
		) {
			setCachedValue({ deviceEvolu })(
				options.queryKey,
				// @ts-expect-error
				data,
			);
		}
	}, [deviceEvolu, cachedData, data, options.queryKey]);

	// @ts-expect-error
	return {
		data:
			data ??
			((cachedData === emptyValue
				? (undefined as TData)
				: cachedData) as TData),
		...rest,
	};
};
