import type { z } from "zod";
import { universalFetch } from "@/lib/fetch";

export const fetchApi = async <T>(
	input: Parameters<typeof universalFetch>[0],
	options: Parameters<typeof universalFetch>[1] & {
		schema: z.ZodSchema<T, string>;
	},
): Promise<T> => {
	const result = await universalFetch(input, options);
	const text = await result.text();
	console.log("text", result.status, text);

	if (result.status < 200 || result.status > 299) {
		throw new Error(result.statusText);
	}

	return options.schema.parse(text);
};
