import { format } from "date-fns";
import { v4, v7 } from "uuid";
import { z } from "zod";

export const PercentSchema = z
	.number()
	.min(0)
	.max(100)
	.brand<"Percent", "inout">();
export const Percent = <T extends number>(value: T): Percent =>
	PercentSchema.parse(value);
export type Percent = z.output<typeof PercentSchema>;

export const IntegerStringSchema = z
	.string()
	.regex(/^-?\d+$/, { error: "Expected to be a integer" })
	.brand<"IntegerString", "inout">();
export const IntegerString = (value: string): IntegerString =>
	IntegerStringSchema.parse(value);
export type IntegerString = z.output<typeof IntegerStringSchema>;

export const NumberStringSchema = z
	.string()
	.regex(/^-?\d+(\.\d*)?$/, { error: "Expected to be a number" })
	.brand<"IntegerString", "inout">()
	.brand<"NumberString", "inout">()
	.brand<"NonEmptyString", "inout">();
export const NumberString = (value: string): NumberString =>
	NumberStringSchema.parse(value);
export type NumberString = z.output<typeof NumberStringSchema>;

export const IntegerSchema = z
	.number()
	.int("Expected to be an integer")
	.brand<"Integer", "inout">();
export const Integer = <T extends number>(value: T): Integer =>
	IntegerSchema.parse(value);
export type Integer = z.output<typeof IntegerSchema>;

export const PositiveNumberSchema = z
	.number()
	.min(1, "Expected to be a positive number")
	.brand<"NonNegative", "inout">()
	.brand<"Positive", "inout">();
export const PositiveNumber = <T extends number>(value: T): PositiveNumber =>
	PositiveNumberSchema.parse(value);
export type PositiveNumber = z.output<typeof PositiveNumberSchema>;

export const PositiveIntegerSchema = PositiveNumberSchema.int(
	"Expected to be an integer",
).brand<"Integer", "inout">();
export const PositiveInteger = <T extends number>(value: T): PositiveInteger =>
	PositiveIntegerSchema.parse(value);
export type PositiveInteger = z.output<typeof PositiveIntegerSchema>;

export const TimestampMsSchema = z
	.number()
	.int("Expected to be an integer")
	.min(1, "Expected to be a positive integer")
	.brand<"Integer", "inout">()
	.brand<"Positive", "inout">()
	.brand<"TimestampMs", "inout">();
export const TimestampMs = <T extends number>(value: T): TimestampMs =>
	TimestampMsSchema.parse(value);
export type TimestampMs = z.output<typeof TimestampMsSchema>;

export const TimestampSecSchema = z
	.number()
	.int("Expected to be an integer")
	.min(1, "Expected to be a positive integer")
	.brand<"Integer", "inout">()
	.brand<"Positive", "inout">()
	.brand<"TimestampSec", "inout">();
export const TimestampSec = <T extends number>(value: T): TimestampSec =>
	TimestampSecSchema.parse(value);
export type TimestampSec = z.output<typeof TimestampSecSchema>;

export const NonNegativeIntegerSchema = z
	.number()
	.int("Expected to be an integer")
	.min(0, "Expected to be an non-negative integer")
	.brand<"Integer", "inout">()
	.brand<"NonNegative", "inout">();
export const NonNegativeInteger = <T extends number>(
	value: T,
): NonNegativeInteger => NonNegativeIntegerSchema.parse(value);
export type NonNegativeInteger = z.output<typeof NonNegativeIntegerSchema>;

export const NonEmptyStringSchema = z
	.string()
	.min(1, "Expected to be a non empty string")
	.brand<"NonEmptyString", "inout">();
export const NonEmptyString = <T extends string>(value: T): NonEmptyString =>
	NonEmptyStringSchema.parse(value);
export type NonEmptyString = z.output<typeof NonEmptyStringSchema>;

export const NonEmptyString32Schema = z
	.string()
	.min(1, "Expected to be a non empty string")
	.max(32, "Expected to be 32 characters in max")
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const NonEmptyString32 = <T extends string>(
	value: T,
): NonEmptyString32 => NonEmptyString32Schema.parse(value);
export type NonEmptyString32 = z.output<typeof NonEmptyString32Schema>;

export const DateStringSchema = z.iso
	.date()
	.brand<"Date", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const DateString = <T extends string>(value: T): DateString =>
	DateStringSchema.parse(value);
export type DateString = z.output<typeof DateStringSchema>;

export const TimeStringSchema = z.iso
	.time()
	.brand<"Time", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const TimeString = <T extends string>(value: T): TimeString =>
	TimeStringSchema.parse(value);
export type TimeString = z.output<typeof TimeStringSchema>;

export const IbanSchema = z
	.string()
	.min(1, "Expected to be a non empty string")
	.max(32, "Expected to be 32 characters in max")
	.regex(
		/^((CZ|SK)[0-9]{22}|DE[0-9]{20}|(AT|LT)[0-9]{18}|HU[0-9]{26}|NO[0-9]{13}|(?!CZ|SK|DE|AT|LT|HU|NO)[A-Z]{2}[0-9]{13,31})$/,
		"Expected to be IBAN",
	)
	.brand<"Iban", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const Iban = <T extends string>(value: T): Iban =>
	IbanSchema.parse(value);
export type Iban = z.output<typeof IbanSchema>;

export const VariableSymbolSchema = z
	.string()
	.min(1, "Expected to be a non empty string")
	.max(10, "Expected to be 10 characters in max")
	.regex(/^[0-9]{1,10}$/, "Expected to be variable symbol")
	.brand<"VariableSymbol", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const VariableSymbol = <T extends string>(value: T): VariableSymbol =>
	VariableSymbolSchema.parse(value);
export type VariableSymbol = z.output<typeof VariableSymbolSchema>;

export const SpecificSymbolSchema = z
	.string()
	.min(1, "Expected to be a non empty string")
	.max(10, "Expected to be 10 characters in max")
	.regex(/^[0-9]{1,10}$/, "Expected to be specific symbol")
	.brand<"SpecificSymbol", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const SpecificSymbol = <T extends string>(value: T): SpecificSymbol =>
	SpecificSymbolSchema.parse(value);
export type SpecificSymbol = z.output<typeof SpecificSymbolSchema>;

export const ConstantSymbolSchema = z
	.string()
	.min(1, "Expected to be a non empty string")
	.max(4, "Expected to be 4 characters in max")
	.regex(/^[0-9]{1,4}$/, "Expected to be constant symbol")
	.brand<"ConstantSymbol", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const ConstantSymbol = <T extends string>(value: T): ConstantSymbol =>
	ConstantSymbolSchema.parse(value);
export type ConstantSymbol = z.output<typeof ConstantSymbolSchema>;

export const PhoneSchema = z
	.string()
	.trim()
	.min(1, "Expected to be phone")
	.max(32, "Expected to be 32 characters in max")
	.refine((value) => {
		const digitsOnly = value.replace(/\D/g, "");
		return digitsOnly.length >= 6 && digitsOnly.length <= 32;
	}, "Expected to be phone")
	.brand<"Phone", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const Phone = <T extends string>(value: T): Phone =>
	PhoneSchema.parse(value);
export type Phone = z.output<typeof PhoneSchema>;

export const EmailSchema = z
	.email({
		error: "Expected to be email",
	})
	.max(255, "Expected to be 255 characters in max")
	.brand<"Email", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const Email = <T extends string>(value: T): Email =>
	EmailSchema.parse(value);
export type Email = z.output<typeof EmailSchema>;

export const HttpsUrlSchema = z
	.url({
		protocol: /^https$/,
		error: "Expected to be an URL with https",
	})
	.brand<"HttpsUrl", "inout">()
	.brand<"NonEmptyString", "inout">();
export const HttpsUrl = <T extends string>(value: T): HttpsUrl =>
	HttpsUrlSchema.parse(value);
export type HttpsUrl = z.output<typeof HttpsUrlSchema>;

export const NonEmptyString64Schema = z
	.string()
	.min(1, "Expected to be a non empty string")
	.max(64, "Expected to be 64 characters in max")
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const NonEmptyString64 = <T extends string>(
	value: T,
): NonEmptyString64 => NonEmptyString64Schema.parse(value);
export type NonEmptyString64 = z.output<typeof NonEmptyString64Schema>;

export const NonEmptyString255Schema = z
	.string()
	.min(1, "Expected to be a non empty string")
	.max(255, "Expected to be 255 characters in max")
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const NonEmptyString255 = <T extends string>(
	value: T,
): NonEmptyString255 => NonEmptyString255Schema.parse(value);
export type NonEmptyString255 = z.output<typeof NonEmptyString255Schema>;

const uuidRegex =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uuid7Regex =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uuid4Regex =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const UuidSchema = z
	.string()
	.regex(uuidRegex, "Expected to be uuid")
	.brand<"NonEmptyString", "inout">()
	.brand<"Uuid", "inout">();
export type Uuid = z.output<typeof UuidSchema>;
export const Uuid = <T extends string>(value: T): Uuid =>
	UuidSchema.parse(value);

export const Uuid4Schema = z
	.string()
	.regex(uuid4Regex, "Expected to be uuid4")
	.brand<"NonEmptyString", "inout">()
	.brand<"Uuid", "inout">()
	.brand<"Uuid4", "inout">();
export type Uuid4 = z.output<typeof Uuid4Schema>;
export const Uuid4 = <T extends string>(value: T): Uuid4 =>
	Uuid4Schema.parse(value);
Uuid4.random = (): Uuid4 => v4() as Uuid4;

export const Uuid7Schema = z
	.string()
	.regex(uuid7Regex, "Expected to be uuid7")
	.brand<"NonEmptyString", "inout">()
	.brand<"Uuid", "inout">()
	.brand<"Uuid7", "inout">();
export type Uuid7 = z.output<typeof Uuid7Schema>;
export const Uuid7 = <T extends string>(value: T): Uuid7 =>
	Uuid7Schema.parse(value);
Uuid7.random = (): Uuid7 => v7() as Uuid7;

export const WssUrlSchema = z
	.url({ protocol: /^wss$/ })
	.brand<"NonEmptyString", "inout">()
	.brand<"WssUrl", "inout">();
export type WssUrl = z.output<typeof WssUrlSchema>;
export const WssUrl = <T extends string>(value: T): WssUrl =>
	WssUrlSchema.parse(value);

export type InferEnumType<T extends Record<string, string>> = T[keyof T];

export const FiatCurrency = {
	USD: "USD",
	EUR: "EUR",
	CZK: "CZK",
} as const;
export type FiatCurrency = InferEnumType<typeof FiatCurrency>;

export const Currency = {
	...FiatCurrency,
	BTC: "BTC",
} as const;
export type Currency = InferEnumType<typeof Currency>;

export const CountryCode = {
	CZ: "CZ",
} as const;
export type CountryCode = InferEnumType<typeof CountryCode>;

export const Timezone = {
	"Europe/Prague": "Europe/Prague",
	UTC: "UTC",
} as const;
export type Timezone = InferEnumType<typeof Timezone>;

export const ProductCodeType = {
	EAN: "EAN",
	ISBN: "ISBN",
} as const;
export type ProductCodeType = InferEnumType<typeof ProductCodeType>;

export const emptyStringToNullTransformation = (
	value: string | null,
): string | null => (value !== "" ? value : null);

export const emptyStringToUndefinedTransformation = (
	value: string,
): string | undefined => (value !== "" ? value : undefined);

export const StringToNullableStringSchema = z
	.string()
	.trim()
	.transform(emptyStringToNullTransformation);

export const StringToUndefinedStringSchema = z
	.string()
	.trim()
	.transform(emptyStringToUndefinedTransformation);

export const SqliteBoolSchema = z.union([z.literal(0), z.literal(1)]);

export const BoolToSqliteBoolSchema = z
	.boolean()
	.transform((value) => (value ? 1 : 0))
	.pipe(SqliteBoolSchema);

export const DateToDateString = (date: Date) =>
	format(date, "yyyy-MM-dd") as DateString;
export const DateToDateStringSchema = z
	.date()
	.transform(DateToDateString)
	.pipe(DateStringSchema);

export const StringToNumberSchema = StringToNullableStringSchema.transform(
	(value) => (value === null ? null : Number(value)),
).pipe(z.number());

export const StringToNullableNumberSchema =
	StringToNullableStringSchema.transform((value) =>
		value === null ? null : Number(value),
	).pipe(z.number().nullable());

export const IdentificationNumberCzSchema = z
	.string()
	.regex(/^[0-9]{8}$/, "Expected to be Czech identification number")
	.brand<"IdentificationNumberCz", "inout">()
	.brand<"NonEmptyString", "inout">()
	.brand<"NonEmptyString32", "inout">()
	.brand<"NonEmptyString64", "inout">()
	.brand<"NonEmptyString255", "inout">();
export const IdentificationNumberCz = <T extends string>(
	value: T,
): IdentificationNumberCz => IdentificationNumberCzSchema.parse(value);
export type IdentificationNumberCz = z.output<
	typeof IdentificationNumberCzSchema
>;

export const NwcCredentialsSchema = z
	.string()
	.regex(
		/^nostr\+walletconnect:\/\/([a-f0-9]{64})\?(?=.*secret=([a-f0-9]{64}))(?=.*relay=[^&]+).*$/,
		"Expected to be NWC credentials",
	)
	.brand<"NwcCredentials", "inout">()
	.brand<"NonEmptyString", "inout">();
export const NwcCredentials = <T extends string>(value: T): NwcCredentials =>
	NwcCredentialsSchema.parse(value);
export type NwcCredentials = z.output<typeof NwcCredentialsSchema>;
