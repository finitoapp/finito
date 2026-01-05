import { useSetAtom } from "jotai";
import { generateSeedWords } from "nostr-tools/nip06";
import type React from "react";
import { z } from "zod";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { seedAtom } from "@/atoms/seed";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { NonEmptyString, WssUrl } from "@/lib/types";

const formSchema = z.object({});
const components = createAutoFormLayout(formSchema, () => ({}));

export const NewAccountForm: React.FC<{
	onSuccess: () => unknown;
}> = (props) => {
	const setRelays = useSetAtom(nostrRelaysAtom);
	const setSeed = useSetAtom(seedAtom);
	const form = useActionForm(formSchema, {
		defaultValues: {},
		saveAction: async () => {
			setSeed(NonEmptyString(generateSeedWords()));
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
		<AutoForm
			form={form}
			components={components}
			saveLabel={"Generate a new account"}
		/>
	);
};
