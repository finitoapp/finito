"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useSetQueryParam() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	return (
		key: string,
		value: string | null,
		options?: { replace?: boolean },
	) => {
		const params = new URLSearchParams(searchParams.toString());

		if (value == null || value === "") {
			params.delete(key);
		} else {
			params.set(key, value);
		}

		const query = params.toString();
		const url = query ? `${pathname}?${query}` : pathname;

		if (options?.replace ?? true) {
			router.replace(url as Route);
		} else {
			router.push(url as Route);
		}
	};
}
