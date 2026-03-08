// types/bigint-override.d.ts
import {IntegerString} from "./custom";
import {TimestampMs} from "@/lib/shared/types";

declare global {
	interface BigInt {
		toString(radix?: number): IntegerString;
	}

	interface DateConstructor {
		now(): TimestampMs;
		parse(s: string): TimestampMs;
	}

	interface Date {
		getTime(): TimestampMs;
	}

}

export {};
