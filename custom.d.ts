// types/bigint-override.d.ts
import {IntegerString} from "./custom";

declare global {
	interface BigInt {
		toString(radix?: number): IntegerString;
	}
}

export {};
