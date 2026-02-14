"use client";

import {
	createId,
	createRandomBytes,
	getOrThrow,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo, useEffect, useEffectEvent } from "react";
import type { EmptyObject } from "type-fest";
import { z } from "zod";
import { accountAtom } from "@/atoms/account";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import {
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToUndefinedStringSchema,
	WssUrlSchema,
} from "@/lib/types";

const transportTypeWebsocket = "websocket";

const relaySchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	isActive: z.boolean(),
	url: StringToNullableStringSchema.pipe(WssUrlSchema),
});

const transportSchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	type: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	isActive: z.boolean(),
	url: StringToNullableStringSchema.pipe(WssUrlSchema),
});

export const credentialsSchema = z.object({
	npub: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	nsec: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	seed: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	relays: relaySchema.array(),
	transports: transportSchema.array(),
});

const relayDefaultValues: z.input<typeof relaySchema> = {
	id: "",
	isActive: true,
	url: "",
};

const transportDefaultValues: z.input<typeof transportSchema> = {
	id: "",
	type: transportTypeWebsocket,
	isActive: true,
	url: "",
};

const credentialsDefaultValues: z.input<typeof credentialsSchema> = {
	npub: "",
	nsec: "",
	seed: "",
	relays: [],
	transports: [],
};

const createComponents = (t: TFunction) => createAutoFormLayout(credentialsSchema, ({ builder }) => ({
	...builder.magicInput("seed").textarea({
		label: t("settings:form.credentials-form.label.seed"),
		disabled: true,
		copyToClipboard: true,
		secretContent: true,
		rows: 4,
	}),
	...builder.card(
		{
			title: t("settings:form.credentials-form.title.evolu-transports"),
		},
		{
			...builder.arrayTableField(
				{
					name: "transports",
					addRowLabel: t("settings:form.credentials-form.addRowLabel.add-transport"),
					defaultValue: transportDefaultValues,
					columns: [
						{
							title: t("settings:form.credentials-form.title.id"),
							hidden: true,
						},
						{
							title: t("settings:form.credentials-form.title.type"),
							hidden: true,
						},
						{
							title: t("settings:form.credentials-form.title.websocket-url"),
						},
						{
							title: t("settings:form.credentials-form.title.active"),
							inputCellClassName: "text-center",
						},
					],
				},
				({ builder }) => ({
					...builder.magicInput("id").text({
						type: "hidden",
					}),
					...builder.magicInput("type").text({
						type: "hidden",
					}),
					...builder.magicInput("url").text({
						label: t("settings:form.credentials-form.label.websocket-url"),
					}),
					...builder.magicInput("isActive").checkbox({
						label: t("settings:form.credentials-form.label.active"),
					}),
				}),
			),
		},
	),
	...builder.card(
		{
			title: t("settings:form.credentials-form.title.nostr-account"),
		},
		{
			...builder.magicInput("npub").text({
				label: t("settings:form.credentials-form.label.npub"),
				disabled: true,
				copyToClipboard: true,
			}),
			...builder.magicInput("nsec").text({
				label: t("settings:form.credentials-form.label.nsec"),
				disabled: true,
				copyToClipboard: true,
				secretContent: true,
			}),
		},
	),
	...builder.card(
		{
			title: t("settings:form.credentials-form.title.nostr-relays"),
		},
		{
			...builder.arrayTableField(
				{
					name: "relays",
					addRowLabel: t("settings:form.credentials-form.addRowLabel.add-relay"),
					defaultValue: relayDefaultValues,
					columns: [
						{
							title: t("settings:form.credentials-form.title.id"),
							hidden: true,
						},
						{
							title: t("settings:form.credentials-form.title.url"),
						},
						{
							title: t("settings:form.credentials-form.title.active"),
							className: "w-24",
						},
					],
				},
				({ builder }) => ({
					...builder.magicInput("id").text({
						type: "hidden",
					}),
					...builder.magicInput("url").text({
						label: t("settings:form.credentials-form.label.relay-url"),
					}),
					...builder.magicInput("isActive").checkbox({
						label: t("settings:form.credentials-form.label.active"),
					}),
				}),
			),
		},
	),
}));

export const CredentialsForm: React.FC<EmptyObject> = () => {
	const { t } = useTranslation();
	const account = useAtomValue(accountAtom);
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const accountId = account.id as never;
	const { mnemonic } = account;
	const { ndk } = useNostr();

	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(credentialsSchema, {
		defaultValues: credentialsDefaultValues,
		saveAction: async (values) => {
			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};

			const currentRelays = await deviceEvolu.loadQuery(
				deviceEvolu.createQuery((db) =>
					db
						.selectFrom("accountNostrRelay")
						.select(["accountNostrRelay.id as id"])
						.where("accountNostrRelay.accountId", "=", accountId)
						.where("accountNostrRelay.isDeleted", "is not", sqliteTrue),
				),
			);

			const originalRelayIds = new Set(currentRelays.map((relay) => relay.id));

			for (const relay of values.relays) {
				const id = relay.id ? (relay.id as never) : createId(createIdDeps);
				if (relay.id) {
					originalRelayIds.delete(relay.id as never);
				}

				getOrThrow(
					deviceEvolu.upsert("accountNostrRelay", {
						id,
						accountId,
						isActive: relay.isActive ? sqliteTrue : sqliteFalse,
						url: relay.url,
					}),
				);
			}

			for (const relayId of originalRelayIds) {
				getOrThrow(
					deviceEvolu.update("accountNostrRelay", {
						id: relayId,
						isDeleted: sqliteTrue,
					}),
				);
			}

			const currentTransports = await deviceEvolu.loadQuery(
				deviceEvolu.createQuery((db) =>
					db
						.selectFrom("accountEvoluTransport")
						.select(["accountEvoluTransport.id as id"])
						.where("accountEvoluTransport.accountId", "=", accountId)
						.where("accountEvoluTransport.isDeleted", "is not", sqliteTrue),
				),
			);

			const originalTransportIds = new Set(
				currentTransports.map((transport) => transport.id),
			);

			for (const transport of values.transports) {
				const id = transport.id
					? (transport.id as never)
					: createId(createIdDeps);
				if (transport.id) {
					originalTransportIds.delete(transport.id as never);
				}

				getOrThrow(
					deviceEvolu.upsert("accountEvoluTransport", {
						id,
						accountId,
						type: transport.type,
						isActive: transport.isActive ? sqliteTrue : sqliteFalse,
					}),
				);

				getOrThrow(
					deviceEvolu.upsert("accountEvoluTransportWebsocket", {
						id,
						url: transport.url,
					}),
				);
			}

			for (const transportId of originalTransportIds) {
				getOrThrow(
					deviceEvolu.update("accountEvoluTransport", {
						id: transportId,
						isDeleted: sqliteTrue,
					}),
				);
				getOrThrow(
					deviceEvolu.update("accountEvoluTransportWebsocket", {
						id: transportId,
						isDeleted: sqliteTrue,
					}),
				);
			}
		},
		onSuccess: () => {},
	});

	const reset = useEffectEvent(async () => {
		const [relayRows, transportRows] = await Promise.all([
			deviceEvolu.loadQuery(
				deviceEvolu.createQuery((db) =>
					db
						.selectFrom("accountNostrRelay")
						.select([
							"accountNostrRelay.id as id",
							"accountNostrRelay.isActive as isActive",
							"accountNostrRelay.url as url",
						])
						.where("accountNostrRelay.accountId", "=", accountId)
						.where("accountNostrRelay.isDeleted", "is not", sqliteTrue),
				),
			),
			deviceEvolu.loadQuery(
				deviceEvolu.createQuery((db) =>
					db
						.selectFrom("accountEvoluTransport")
						.leftJoin(
							"accountEvoluTransportWebsocket",
							"accountEvoluTransportWebsocket.id",
							"accountEvoluTransport.id",
						)
						.select([
							"accountEvoluTransport.id as id",
							"accountEvoluTransport.type as type",
							"accountEvoluTransport.isActive as isActive",
							"accountEvoluTransportWebsocket.url as url",
						])
						.where("accountEvoluTransport.accountId", "=", accountId)
						.where("accountEvoluTransport.isDeleted", "is not", sqliteTrue)
						.where(
							"accountEvoluTransportWebsocket.isDeleted",
							"is not",
							sqliteTrue,
						),
				),
			),
		]);

		form.form.reset({
			npub: ndk.activeUser.npub,
			nsec: ndk.signer instanceof NDKPrivateKeySigner ? ndk.signer.nsec : "",
			seed: mnemonic,
			relays:
				relayRows.length === 0
					? credentialsDefaultValues.relays
					: relayRows.map((relay) => ({
							id: relay.id,
							isActive: Boolean(relay.isActive),
							url: relay.url,
						})),
			transports: transportRows.map((transport) => ({
				id: transport.id,
				type: transport.type ?? transportTypeWebsocket,
				isActive: Boolean(transport.isActive),
				url: transport.url ?? "",
			})),
		});
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies(ndk.activeUser.pubkey): suppress dependency ndk.activeUser.pubkey
	useEffect(() => {
		void reset();
	}, [ndk.activeUser.pubkey]);

	return <AutoForm form={form} components={components} />;
};
