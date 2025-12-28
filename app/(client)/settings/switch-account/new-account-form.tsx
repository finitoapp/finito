import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { useSetAtom } from "jotai";
import type React from "react";
import { z } from "zod";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { nostrSignerAtom } from "@/atoms/nostr-signer";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { WssUrl } from "@/lib/types";

const formSchema = z.object({});
const components = createAutoFormLayout(formSchema, () => ({}));

export const NewAccountForm: React.FC<{
	onSuccess: () => unknown;
}> = (props) => {
	const setRelays = useSetAtom(nostrRelaysAtom);
	const setNostrSigner = useSetAtom(nostrSignerAtom);
	const form = useActionForm(formSchema, {
		defaultValues: {},
		saveAction: async () => {
			setNostrSigner({
				ndkSignerPayload: NDKPrivateKeySigner.generate().toPayload(),
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
		<AutoForm
			form={form}
			components={components}
			saveLabel={"Generate a new account"}
		/>
	);
};
