import type React from "react";
import { v7 } from "uuid";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import {
	EmailSchema,
	FiatCurrency,
	IbanSchema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import { accountStorage } from "@/storages/account-storage";

const baseItemSchema = z.object({
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	_tag: z.enum(["iban", "lud16", "spark", "cash_register"]),
	iban: z.string(),
	lud16: z.string(),
	mnemonic: z.string(),
	currency: z.enum(FiatCurrency).nullable(),
});

const itemSchema = z.union([
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
	baseItemSchema.extend({
		_tag: z.literal("spark"),
		mnemonic: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
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
	mnemonic: "",
	currency: null,
} satisfies z.input<typeof itemSchema>;

const components = createAutoFormLayout(itemSchema, ({ builder }) => ({
	...builder.magicInput("name").text({
		label: "Name",
	}),
	...builder.magicInput("_tag").select({
		allowEmpty: false,
		values: {
			iban: "Bank account (IBAN)",
			lud16: "BTC Wallet (LUD16)",
			spark: "Spark bitcoin L2",
			cash_register: "Cash register",
		},
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
	...builder.when("_tag", "spark", {
		...builder.magicInput("mnemonic").textarea({
			label: "Mnemonic",
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
}> = (params) => {
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

			const { eventId } = await accountStorage.insertOrUpdate(ndk, id, {
				id,
				...values,
			});

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
