import { useSetAtom } from "jotai";
import type React from "react";
import { z } from "zod";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { seedAtom } from "@/atoms/seed";
import { seedsAtom } from "@/atoms/seeds";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import {
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	WssUrl,
} from "@/lib/types";

export const switchAccountSchema = z.object({
	seed: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
});

export const switchUserDefaultValues = {
	seed: "",
} satisfies z.input<typeof switchAccountSchema>;

const components = createAutoFormLayout(switchAccountSchema, ({ builder }) => ({
	...builder.magicInput("seed").textarea({
		placeholder: "paste your seed",
		rows: 4,
	}),
}));

export const SwitchAccountForm: React.FC<{
	onSuccess?: () => unknown;
}> = (props) => {
	const setSeed = useSetAtom(seedAtom);
	const setSeeds = useSetAtom(seedsAtom);
	const setRelays = useSetAtom(nostrRelaysAtom);
	const form = useActionForm(switchAccountSchema, {
		defaultValues: switchUserDefaultValues,
		saveAction: async (values) => {
			setSeed(values.seed);
			setSeeds((previous) => {
				for (const previousSeed of (previous ?? { seeds: [] }).seeds) {
					if (previousSeed === values.seed) {
						return previous;
					}
				}

				return {
					seeds: [...(previous !== null ? previous.seeds : []), values.seed],
				};
			});
			setRelays({
				relays: [
					WssUrl("wss://relay.primal.net"),
					WssUrl("wss://relay.damus.io"),
				],
			});
		},
		onSuccess: props.onSuccess,
	});

	return (
		<AutoForm form={form} components={components} saveLabel={"Use seed"} />
	);
};
