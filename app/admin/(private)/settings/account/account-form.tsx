"use client";

import type { NDKUserProfile } from "@nostr-dev-kit/ndk";
import type React from "react";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import {
	EmailSchema,
	HttpsUrlSchema,
	NonEmptyStringSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";

export const accountSchema = z.object({
	name: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	displayName: StringToUndefinedStringSchema.pipe(
		NonEmptyStringSchema.optional(),
	),
	about: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	bio: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	website: StringToUndefinedStringSchema.pipe(HttpsUrlSchema.optional()),
	lud16: StringToUndefinedStringSchema.pipe(EmailSchema),
});

const components = createAutoFormLayout(accountSchema, ({ builder }) => ({
	...builder.magicInput("name").text({
		label: "Name",
	}),
	...builder.magicInput("displayName").text({
		label: "Display name",
	}),
	...builder.magicInput("website").text({
		label: "Website",
	}),
	...builder.magicInput("about").textarea({
		label: "About",
	}),
	...builder.magicInput("bio").textarea({
		label: "Bio",
	}),
	...builder.magicInput("lud16").text({
		label: "lud16 address",
	}),
}));

export const AccountForm: React.FC<{
	defaultValues: NDKUserProfile | null;
}> = (props) => {
	const { ndk } = useNostr();
	const form = useActionForm(accountSchema, {
		defaultValues: {
			name: props.defaultValues ? (props.defaultValues.name ?? "") : "",
			about: props.defaultValues ? (props.defaultValues.about ?? "") : "",
			website: props.defaultValues ? (props.defaultValues.website ?? "") : "",
			bio: props.defaultValues ? (props.defaultValues.bio ?? "") : "",
			lud16: props.defaultValues ? (props.defaultValues.lud16 ?? "") : "",
			displayName: props.defaultValues
				? (props.defaultValues.displayName ?? "")
				: "",
		},
		saveAction: async (values) => {
			const profile = await ndk.activeUser.fetchProfile({
				skipOptimisticPublishEvent: true,
			}); // refetch current data
			ndk.activeUser.profile = {
				...(profile ?? {}),
				...values,
			};
			await ndk.activeUser.publish();
		},
		onSuccess: () => {},
	});

	return <AutoForm form={form} components={components} />;
};
