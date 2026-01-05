"use client";

import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { useAtom, useAtomValue } from "jotai";
import type React from "react";
import { useEffect, useEffectEvent } from "react";
import type { EmptyObject } from "type-fest";
import { z } from "zod";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { seedAtom } from "@/atoms/seed";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import {
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	WssUrlSchema,
} from "@/lib/types";

export const credentialsSchema = z.object({
	npub: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	nsec: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	seed: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	relay1: StringToNullableStringSchema.pipe(WssUrlSchema),
	relay2: StringToNullableStringSchema.pipe(WssUrlSchema.nullable()),
	relay3: StringToNullableStringSchema.pipe(WssUrlSchema.nullable()),
	relay4: StringToNullableStringSchema.pipe(WssUrlSchema.nullable()),
});

const components = createAutoFormLayout(credentialsSchema, ({ builder }) => ({
	...builder.magicInput("npub").text({
		label: "Npub",
		disabled: true,
		copyToClipboard: true,
	}),
	...builder.magicInput("nsec").text({
		label: "Nsec",
		disabled: true,
		copyToClipboard: true,
		secretContent: true,
	}),
	...builder.magicInput("seed").textarea({
		label: "Seed",
		disabled: true,
		copyToClipboard: true,
		secretContent: true,
		rows: 4,
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
	const seed = useAtomValue(seedAtom);
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
		defaultValues: () => ({
			...defaultValues,
			seed,
		}),
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
