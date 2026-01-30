import { SparkWallet } from "@buildonspark/spark-sdk";
import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
} from "@evolu/common";
import type { SystemColumns } from "@evolu/common/local-first";
import { merge, omit, pick } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import type { PartialDeep, Simplify } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import type { EvoluSchema } from "@/lib/evolu";
import { assertNever } from "@/lib/type-utils";
import {
	EmailSchema,
	FiatCurrency,
	IbanSchema,
	NonEmptyStringSchema,
	NwcCredentialsSchema,
	StringToNullableStringSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";

const baseAccountSparkSchema = z.object({
	mnemonic: z.string(),
	mnemonicVariant: z.enum(["manual", "new"]),
});

const baseAccountSchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	accountIban: z.object({
		iban: z.string(),
		currency: z.enum(FiatCurrency).nullable(),
	}),
	accountLud16: z.object({
		lud16: z.string(),
	}),
	accountSpark: z.object({
		mnemonic: z.string(),
		mnemonicVariant: z.enum(["manual", "new"]),
	}),
	accountNwc: z.object({
		credentials: z.string(),
	}),
	accountCashRegister: z.object({
		currency: z.enum(FiatCurrency).nullable(),
	}),
});

const accountSchema = z.discriminatedUnion("_tag", [
	baseAccountSchema.extend({
		_tag: z.literal("accountIban"),
		accountIban: z.object({
			iban: StringToUndefinedStringSchema.transform((value) =>
				value ? value.replace(/ /g, "") : value,
			).pipe(IbanSchema),
			currency: z.enum(FiatCurrency).nullable().pipe(z.enum(FiatCurrency)),
		}),
	}),
	baseAccountSchema.extend({
		_tag: z.literal("accountLud16"),
		accountLud16: z.object({
			lud16: StringToNullableStringSchema.pipe(EmailSchema),
		}),
	}),
	baseAccountSchema.extend({
		_tag: z.literal("accountSpark"),
		accountSpark: z.discriminatedUnion("mnemonicVariant", [
			baseAccountSparkSchema.extend({
				mnemonicVariant: z.literal("manual"),
				mnemonic: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
			}),
			baseAccountSparkSchema.extend({
				mnemonicVariant: z.literal("new"),
			}),
		]),
	}),
	baseAccountSchema.extend({
		_tag: z.literal("accountNwc"),
		accountNwc: z.object({
			credentials: StringToNullableStringSchema.pipe(NwcCredentialsSchema),
		}),
	}),
	baseAccountSchema.extend({
		_tag: z.literal("accountCashRegister"),
		accountCashRegister: z.object({
			currency: z.enum(FiatCurrency).nullable().pipe(z.enum(FiatCurrency)),
		}),
	}),
]);

const itemDefaultValues = {
	id: "",
	name: "",
	_tag: "accountIban",
	accountIban: {
		iban: "",
		currency: null,
	},
	accountLud16: {
		lud16: "",
	},
	accountSpark: {
		mnemonicVariant: "new",
		mnemonic: "",
	},
	accountNwc: {
		credentials: "",
	},
	accountCashRegister: {
		currency: null,
	},
} satisfies z.input<typeof accountSchema>;

const tags = {
	accountIban: "Bank account (IBAN)",
	accountLud16: "BTC Wallet (LUD16)",
	accountNwc: "NWC protocol (NostrWalletConnect)",
	accountSpark: "Spark bitcoin L2",
	accountCashRegister: "Cash register",
} as const;

const createComponents = (
	options: { tagFilter?: (keyof typeof tags)[] } = {},
) =>
	createAutoFormLayout(accountSchema, ({ builder }) => ({
		...builder.magicInput("id").text({
			type: "hidden",
		}),
		...builder.magicInput("name").text({
			label: "Name",
		}),
		...builder.magicInput("_tag").select({
			label: "Protocol",
			variant: "toggle",
			allowEmpty: false,
			values: options.tagFilter ? pick(tags, options.tagFilter) : tags,
		}),

		...builder.nestedField("accountIban", ({ builder }) => ({
			...builder.when("_tag", "accountIban", {
				...builder.magicInput("iban").text({
					label: "IBAN",
				}),
				...builder.magicInput("currency").select({
					values: FiatCurrency,
					allowEmpty: false,
					label: "Currency",
				}),
			}),
		})),

		...builder.nestedField("accountLud16", ({ builder }) => ({
			...builder.when("_tag", "accountLud16", {
				...builder.magicInput("lud16").text({
					label: "LUD16",
				}),
			}),
		})),

		...builder.nestedField("accountNwc", ({ builder }) => ({
			...builder.when("_tag", "accountNwc", {
				...builder.magicInput("credentials").textarea({
					label: "Credentials",
					rows: 5,
					secretContent: true,
				}),
			}),
		})),

		...builder.nestedField("accountSpark", ({ builder }) => ({
			...builder.when("_tag", "accountSpark", {
				...builder.magicInput("mnemonicVariant").select({
					label: "Seed",
					allowEmpty: false,
					values: {
						new: "Generate new random seed",
						manual: "Use existing seed",
					},
				}),
				...builder.when("accountSpark.mnemonicVariant", "manual", {
					...builder.magicInput("mnemonic").textarea({
						label: "Mnemonic",
						copyToClipboard: true,
						secretContent: true,
						rows: 4,
					}),
				}),
			}),
		})),

		...builder.nestedField("accountCashRegister", ({ builder }) => ({
			...builder.when("_tag", "accountCashRegister", {
				...builder.magicInput("currency").select({
					values: FiatCurrency,
					allowEmpty: false,
					label: "Currency",
				}),
			}),
		})),
	}));

export const AccountForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof accountSchema>>;
	onSuccess?: (newEventId: string) => unknown;
	tagFilter?: (keyof typeof tags)[];
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(itemDefaultValues, params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(
		() => createComponents({ tagFilter: params.tagFilter }),
		[params.tagFilter],
	);
	const form = useActionForm(accountSchema, {
		defaultValues,
		saveAction: async (values) => {
			const upserts: {
				[key in keyof EvoluSchema]?: Simplify<
					Omit<EvoluSchema[key], keyof SystemColumns | "id">
				>;
			} = {};
			if (values._tag === "accountIban") {
				upserts.accountIban = {
					iban: values.accountIban.iban,
					currency: values.accountIban.currency,
				};
			} else if (values._tag === "accountLud16") {
				upserts.accountLud16 = {
					lud16: values.accountLud16.lud16,
				};
			} else if (values._tag === "accountNwc") {
				upserts.accountNwc = {
					credentials: values.accountNwc.credentials,
				};
			} else if (values._tag === "accountSpark") {
				const mnemonic =
					values.accountSpark.mnemonicVariant === "manual"
						? values.accountSpark.mnemonic
						: (
								await SparkWallet.initialize({
									options: { network: "MAINNET" },
								})
							).mnemonic;

				if (!mnemonic) {
					throw new Error("Unexpected mnemonic value");
				}

				upserts.accountSpark = {
					mnemonic,
				};
			} else if (values._tag === "accountCashRegister") {
				upserts.accountCashRegister = {
					currency: values.accountCashRegister.currency,
				};
			} else {
				assertNever(values);
			}

			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};
			const id = values.id ?? createId(createIdDeps);
			const valuesCopy = omit(values, [
				"accountIban",
				"accountLud16",
				"accountNwc",
				"accountSpark",
				"accountCashRegister",
			]);

			getOrThrow(
				evolu.upsert(
					"account",
					{
						...valuesCopy,
						id,
					},
					{
						onComplete: () => {
							if (params.onSuccess) {
								params.onSuccess(id);
							}
						},
					},
				),
			);

			for (const [key, values] of Object.entries(upserts)) {
				getOrThrow(
					evolu.upsert(key, {
						id,
						...values,
					}),
				);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
