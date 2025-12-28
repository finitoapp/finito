"use client";

import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { useAtom } from "jotai";
import type React from "react";
import { useEffect, useEffectEvent } from "react";
import type { EmptyObject } from "type-fest";
import { credentialsSchema } from "@/app/admin/(private)/settings/credentials/credentials-schema";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";

const components = createAutoFormLayout(credentialsSchema, ({ builder }) => ({
	...builder.magicInput("npub").text({
		label: "Npub",
		disabled: true,
		copyToClipboard: true,
	}),
	...builder.magicInput("nsec").text({
		label: "Nsec",
		disabled: true,
		type: "password",
		copyToClipboard: true,
	}),
	...builder.magicInput("relay1").text({
		label: "Relay 1",
	}),
	...builder.magicInput("relay2").text({
		label: "Relay 2",
	}),
	...builder.magicInput("relay3").text({
		label: "Relay 3",
	}),
	...builder.magicInput("relay4").text({
		label: "Relay 4",
	}),
}));

export const CredentialsForm: React.FC<EmptyObject> = () => {
	const [{ relays }, setRelays] = useAtom(nostrRelaysAtom);
	const { ndk } = useNostr();
	const defaultValues = {
		relay1: relays[0] ?? "",
		relay2: relays[1] ?? "",
		relay3: relays[2] ?? "",
		relay4: relays[3] ?? "",
		npub: ndk.activeUser.npub,
		nsec: ndk.signer instanceof NDKPrivateKeySigner ? ndk.signer.nsec : "",
	};

	const form = useActionForm(credentialsSchema, {
		defaultValues: () => defaultValues,
		saveAction: async (values) => {
			setRelays({
				relays: [
					values.relay1,
					...(values.relay2 ? [values.relay2] : []),
					...(values.relay3 ? [values.relay3] : []),
					...(values.relay4 ? [values.relay4] : []),
				],
			});
		},
		onSuccess: () => {},
	});

	const reset = useEffectEvent(() => {
		form.form.reset(defaultValues);
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies(ndk.activeUser.pubkey): suppress dependency ndk.activeUser.pubkey
	useEffect(() => {
		reset();
	}, [ndk.activeUser.pubkey]);

	return <AutoForm form={form} components={components} />;
};
