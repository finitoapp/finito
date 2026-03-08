import { z } from "zod";
import {
	type Integer,
	IntegerSchema,
	type IntegerString,
	IntegerStringSchema,
} from "@/lib/shared/types";

export const integerStringToBigIntCodec = z.codec(
	IntegerStringSchema,
	z.bigint(),
	{
		decode: (str) => BigInt(str),
		encode: (bigint) => bigint.toString(),
	},
);

export const integerStringToInteger = z.codec(
	IntegerStringSchema,
	IntegerSchema,
	{
		decode: (value) => Number(value) as Integer,
		encode: (value) => value.toFixed(0) as IntegerString,
	},
);

export const epochSecondsToDateCodec = z.codec(z.int().min(0), z.date(), {
	decode: (seconds) => new Date(seconds * 1000),
	encode: (date) => Math.floor(date.getTime() / 1000),
});

export const epochMillisToDateCodec = z.codec(z.int().min(0), z.date(), {
	decode: (millis) => new Date(millis),
	encode: (date) => date.getTime(),
});
