"use client";

import { createId, createRandomBytes, kysely, sqliteTrue } from "@evolu/common";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { TFunction } from "i18next";
import { useAtomValue } from "jotai";
import type { NotNull } from "kysely";
import type React from "react";
import { useEffect, useEffectEvent, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { EmptyObject } from "type-fest";
import { z } from "zod";
import { accountAtom } from "@/atoms/account";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import { createDeviceQuery } from "@/lib/evolu/device";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	BoolToSqliteBoolSchema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	WssUrlSchema,
} from "@/lib/shared/types";

const transportTypeWebsocket = "WebSocket";

const relaySchema = z.object({
	id: TableIdSchema,
	isActive: BoolToSqliteBoolSchema,
	url: StringToNullableStringSchema.pipe(WssUrlSchema),
});

const transportSchema = z.object({
	id: TableIdSchema,
	type: StringToNullableStringSchema.pipe(z.enum(["WebSocket"])),
	isActive: BoolToSqliteBoolSchema,
	url: StringToNullableStringSchema.pipe(WssUrlSchema),
});

export const credentialsSchema = z.object({
	npub: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	nsec: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	seed: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	relays: relaySchema.array(),
	transports: transportSchema.array(),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createRelayDefaultValues = () =>
	({
		id: createId(createIdDeps),
		isActive: true,
		url: "",
	}) satisfies z.input<typeof relaySchema>;

const createTransportDefaultValues = () =>
	({
		id: createId(createIdDeps),
		type: transportTypeWebsocket,
		isActive: true,
		url: "",
	}) satisfies z.input<typeof transportSchema>;

const createCredentialsDefaultValues = () =>
	({
		npub: "",
		nsec: "",
		seed: "",
		relays: [],
		transports: [],
	}) satisfies z.input<typeof credentialsSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(credentialsSchema, ({ builder }) => ({
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
						addRowLabel: t(
							"settings:form.credentials-form.addRowLabel.add-transport",
						),
						defaultValue: createTransportDefaultValues,
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
						addRowLabel: t(
							"settings:form.credentials-form.addRowLabel.add-relay",
						),
						defaultValue: createRelayDefaultValues,
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
	const defaultValues = useMemo(createCredentialsDefaultValues, []);
	const account = useAtomValue(accountAtom);
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const accountId = account.id;
	const { mnemonic } = account;
	const { ndk } = useNostr();

	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(credentialsSchema, {
		defaultValues,
		saveAction: async (values) => {
			const currentRelays = await deviceEvolu.loadQuery(
				createDeviceQuery((db) =>
					db
						.selectFrom("accountNostrRelay")
						.select(["accountNostrRelay.id as id"])
						.where("accountNostrRelay.accountId", "=", accountId)
						.where("accountNostrRelay.isDeleted", "is not", sqliteTrue),
				),
			);

			const originalRelayIds = new Set(currentRelays.map((relay) => relay.id));

			for (const relay of values.relays) {
				originalRelayIds.delete(relay.id);

				deviceEvolu.upsert("accountNostrRelay", {
					id: relay.id,
					accountId,
					isActive: relay.isActive,
					url: relay.url,
				});
			}

			for (const relayId of originalRelayIds) {
				deviceEvolu.update("accountNostrRelay", {
					id: relayId,
					isDeleted: sqliteTrue,
				});
			}

			const currentTransports = await deviceEvolu.loadQuery(
				createDeviceQuery((db) =>
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
				originalTransportIds.delete(transport.id);

				deviceEvolu.upsert("accountEvoluTransport", {
					id: transport.id,
					accountId,
					type: transport.type,
					isActive: transport.isActive,
				});

				deviceEvolu.upsert("accountEvoluTransportWebsocket", {
					id: transport.id,
					url: transport.url,
				});
			}

			for (const transportId of originalTransportIds) {
				deviceEvolu.update("accountEvoluTransport", {
					id: transportId,
					isDeleted: sqliteTrue,
				});
				deviceEvolu.update("accountEvoluTransportWebsocket", {
					id: transportId,
					isDeleted: sqliteTrue,
				});
			}
		},
		onSuccess: () => {},
	});

	const reset = useEffectEvent(async () => {
		const [relayRows, transportRows] = await Promise.all([
			deviceEvolu.loadQuery(
				createDeviceQuery((db) =>
					db
						.selectFrom("accountNostrRelay")
						.select([
							"accountNostrRelay.id as id",
							"accountNostrRelay.isActive as isActive",
							"accountNostrRelay.url as url",
						])
						.where("accountNostrRelay.accountId", "=", accountId)
						.where("accountNostrRelay.isDeleted", "is not", sqliteTrue)
						.where("accountNostrRelay.isActive", "is not", null)
						.where("accountNostrRelay.url", "is not", null)
						.$narrowType<{
							isActive: NotNull;
							url: NotNull;
						}>(),
				),
			),
			deviceEvolu.loadQuery(
				createDeviceQuery((db) =>
					db
						.selectFrom("accountEvoluTransport")
						.select((eb) => [
							"accountEvoluTransport.id as id",
							"accountEvoluTransport.type as type",
							"accountEvoluTransport.isActive as isActive",

							kysely
								.jsonObjectFrom(
									eb
										.selectFrom("accountEvoluTransportWebsocket")
										.select(["accountEvoluTransportWebsocket.url as url"])
										.whereRef(
											"accountEvoluTransportWebsocket.id",
											"=",
											"accountEvoluTransport.id",
										)
										.where(
											"accountEvoluTransportWebsocket.isDeleted",
											"is not",
											sqliteTrue,
										)
										.where("accountEvoluTransportWebsocket.url", "is not", null)
										.$narrowType<{
											url: NotNull;
										}>(),
								)
								.as("websocket"),
						])
						.where("accountEvoluTransport.accountId", "=", accountId)
						.where("accountEvoluTransport.isDeleted", "is not", sqliteTrue)
						.$narrowType<{
							type: NotNull;
						}>(),
				),
			),
		]);

		form.form.reset({
			npub: ndk.activeUser.npub,
			nsec: ndk.signer instanceof NDKPrivateKeySigner ? ndk.signer.nsec : "",
			seed: mnemonic,
			relays:
				relayRows.length === 0
					? defaultValues.relays
					: relayRows.map((relay) => ({
							id: relay.id,
							isActive: Boolean(relay.isActive),
							url: relay.url,
						})),
			transports: transportRows.map((transport) => ({
				id: transport.id,
				type: transport.type,
				isActive: Boolean(transport.isActive),
				url: transport.websocket?.url ?? "",
			})),
		});
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies(ndk.activeUser.pubkey): suppress dependency ndk.activeUser.pubkey
	useEffect(() => {
		void reset();
	}, [ndk.activeUser.pubkey]);

	return <AutoForm form={form} components={components} />;
};
