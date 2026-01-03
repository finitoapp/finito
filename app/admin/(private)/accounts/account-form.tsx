import { SparkWallet } from "@buildonspark/spark-sdk";
import { pick } from "es-toolkit";
import type React from "react";
import { useMemo } from "react";
import { v7 } from "uuid";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import { assertNever } from "@/lib/type-utils";
import {
	EmailSchema,
	FiatCurrency,
	IbanSchema,
	NonEmptyString,
	NonEmptyStringSchema,
	NwcCredentialsSchema,
	StringToNullableStringSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import { accountStorage } from "@/storages/account-storage";

const baseItemSchema = z.object({
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	_tag: z.enum(["iban", "lud16", "spark", "nwc", "cash_register"]),
	iban: z.string(),
	lud16: z.string(),
	credentials: z.string(),
	mnemonic: z.string(),
	mnemonicVariant: z.enum(["manual", "new"]),
	currency: z.enum(FiatCurrency).nullable(),
});

const itemSchema = z.discriminatedUnion("_tag", [
	baseItemSchema.extend({
		_tag: z.literal("iban"),
		iban: StringToUndefinedStringSchema.transform((value) =>
			value ? value.replace(/ /g, "") : value,
		).pipe(IbanSchema),
		currency: z.enum(FiatCurrency).nullable().pipe(z.enum(FiatCurrency)),
	}),
	baseItemSchema.extend({
		_tag: z.literal("lud16"),
		lud16: StringToNullableStringSchema.pipe(EmailSchema),
	}),
	z.discriminatedUnion("mnemonicVariant", [
		baseItemSchema.extend({
			_tag: z.literal("spark"),
			mnemonicVariant: z.literal("manual"),
			mnemonic: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
		}),
		baseItemSchema.extend({
			_tag: z.literal("spark"),
			mnemonicVariant: z.literal("new"),
		}),
	]),
	baseItemSchema.extend({
		_tag: z.literal("nwc"),
		credentials: StringToNullableStringSchema.pipe(NwcCredentialsSchema),
	}),
	baseItemSchema.extend({
		_tag: z.literal("cash_register"),
		currency: z.enum(FiatCurrency).nullable().pipe(z.enum(FiatCurrency)),
	}),
]);

const itemDefaultValues = {
	name: "",
	_tag: "iban",
	iban: "",
	lud16: "",
	credentials: "",
	mnemonicVariant: "new",
	mnemonic: "",
	currency: null,
} satisfies z.input<typeof itemSchema>;

const tags = {
	iban: "Bank account (IBAN)",
	lud16: "BTC Wallet (LUD16)",
	nwc: "NWC protocol (NostrWalletConnect)",
	spark: "Spark bitcoin L2",
	cash_register: "Cash register",
} as const;

const createComponents = (
	options: { tagFilter?: (keyof typeof tags)[] } = {},
) =>
	createAutoFormLayout(itemSchema, ({ builder }) => ({
		...builder.magicInput("name").text({
			label: "Name",
		}),
		...builder.magicInput("_tag").select({
			label: "Protocol",
			allowEmpty: false,
			values: options.tagFilter ? pick(tags, options.tagFilter) : tags,
		}),
		...builder.when("_tag", "iban", {
			...builder.magicInput("iban").text({
				label: "IBAN",
			}),
			...builder.magicInput("currency").select({
				values: FiatCurrency,
				allowEmpty: false,
				label: "Currency",
			}),
		}),
		...builder.when("_tag", "lud16", {
			...builder.magicInput("lud16").text({
				label: "LUD16",
			}),
		}),
		...builder.when("_tag", "nwc", {
			...builder.magicInput("credentials").textarea({
				label: "Credentials",
				rows: 5,
				secretContent: true,
			}),
		}),
		...builder.when("_tag", "spark", {
			...builder.magicInput("mnemonicVariant").select({
				label: "Seed",
				allowEmpty: false,
				values: {
					new: "Generate new random seed",
					manual: "Use existing seed",
				},
			}),
			...builder.when("mnemonicVariant", "manual", {
				...builder.magicInput("mnemonic").textarea({
					label: "Mnemonic",
					copyToClipboard: true,
					secretContent: true,
				}),
			}),
		}),
		...builder.when("_tag", "cash_register", {
			...builder.magicInput("currency").select({
				values: FiatCurrency,
				allowEmpty: false,
				label: "Currency",
			}),
		}),
	}));

export const AccountForm: React.FC<{
	defaultValues?: Partial<z.input<typeof itemSchema> & { id: string }>;
	onSuccess?: (newEventId: string) => unknown;
	tagFilter?: (keyof typeof tags)[];
}> = (params) => {
	const components = useMemo(
		() => createComponents({ tagFilter: params.tagFilter }),
		[params.tagFilter],
	);
	const { ndk } = useNostr();
	const form = useActionForm(itemSchema, {
		defaultValues: {
			...itemDefaultValues,
			...(params.defaultValues ?? {}),
		},
		saveAction: async (values) => {
			const id =
				params.defaultValues && params.defaultValues.id
					? params.defaultValues.id
					: v7();

			const sparkValues = await (async () => {
				if (values._tag === "iban") {
					return {
						_tag: values._tag,
						iban: values.iban,
						currency: values.currency,
					} as const;
				}

				if (values._tag === "lud16") {
					return {
						_tag: values._tag,
						lud16: values.lud16,
					} as const;
				}

				if (values._tag === "nwc") {
					return {
						_tag: values._tag,
						credentials: values.credentials,
					} as const;
				}

				if (values._tag === "cash_register") {
					return {
						_tag: values._tag,
						currency: values.currency,
					} as const;
				}

				if (values._tag === "spark") {
					if (values.mnemonicVariant === "manual") {
						return {
							_tag: "spark",
							mnemonic: values.mnemonic,
						} as const;
					}

					const { mnemonic } = await SparkWallet.initialize({
						options: {
							network: "MAINNET",
						},
					});

					if (mnemonic === undefined) {
						console.error("Unexpected mnemonic value");
						return;
					}

					return {
						_tag: "spark",
						mnemonic: NonEmptyString(mnemonic),
					} as const;
				}

				assertNever(values);
			})();

			if (sparkValues === undefined) {
				return;
			}

			const { eventId } = await accountStorage.insertOrUpdate(ndk, id, {
				id,
				name: values.name,
				...sparkValues,
			});

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
