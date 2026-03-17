"use client";

import {
	createIdFromString,
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useAtomValue } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";
import { type ComponentProps, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { accountAtom } from "@/atoms/account";
import { FadeHeader } from "@/components/fade-header";
import { SendOrReceivePayment } from "@/components/send-or-receive-payment";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";
import {
	createLud16Payment,
	createOutgoingPayment,
} from "@/lib/payment/service";
import { Currency } from "@/lib/shared/types";

export default function Page() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const router = useRouter();
	const searchParams = useSearchParams();
	const account = useAtomValue(accountAtom);
	const id = searchParams.get("id");
	if (id === null) throw Promise.reject();

	const contactId = id as Id;

	const contactQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("contact")
					.select(
						(eb) =>
							[
								"id",
								"name",
								"label",

								evoluJsonArrayFrom(
									eb
										.selectFrom("contactAccount")
										.select(
											(eb) =>
												[
													evoluJsonObjectFrom(
														eb
															.selectFrom("contactAccountLud16")
															.select(["contactAccountLud16.lud16 as lud16"])
															.whereRef(
																"contactAccountLud16.id",
																"=",
																"contactAccount.id",
															)
															.where(
																"contactAccountLud16.isDeleted",
																"is not",
																sqliteTrue,
															)
															.$narrowType<{
																lud16: KyselyNotNull;
															}>(),
													).as("lud16"),
												] as const,
										)
										.whereRef("contactAccount.contactId", "=", "contact.id")
										.where("contactAccount.isDeleted", "is not", sqliteTrue)
										.where("contactAccount._tag", "=", "accountLud16"),
								).as("accounts"),
							] as const,
					)
					.where("contact.isDeleted", "is not", sqliteTrue)
					.where("contact.name", "is not", null)
					.where("contact.id", "=", contactId)
					.$narrowType<{
						name: KyselyNotNull;
					}>()
					.limit(1),
			),
		[contactId],
	);

	const { data: contactRows } = useEvoluQuery(contactQuery);
	const contact = contactRows[0];
	const contactAccount = contact.accounts[0];

	const save = useCallback<
		ComponentProps<typeof SendOrReceivePayment>["onSubmit"]
	>(
		async (props) => {
			if (contactAccount === undefined) {
				return;
			}

			const lud16 = contactAccount.lud16;
			if (lud16 === null) {
				return;
			}

			const accounts = await evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("account")
						.leftJoin("accountSpark", "accountSpark.id", "account.id")
						.select([
							"account.id as id",
							"account._tag as _tag",
							"accountSpark.mnemonic as mnemonic",
						] as const)
						.where("account.isDeleted", "is not", sqliteTrue)
						.where("accountSpark.mnemonic", "is not", null)
						.where("account.id", "=", props.paymentLnSpark.selectedAccountId)
						.where("account._tag", "=", "accountSpark")
						.$narrowType<{
							mnemonic: KyselyNotNull;
						}>(),
				),
			);

			const moneyAccount = accounts[0];
			if (moneyAccount === undefined) {
				return;
			}

			const { lnInvoice } = await createLud16Payment({
				amountInSats: props.satsAmount,
				lud16: lud16.lud16,
			});

			createOutgoingPayment({ evolu })({
				payment: {
					id: createIdFromString(lnInvoice),
					totalAmount: props.satsAmount,
					currency: Currency.BTC,
					deviceId: account.device.id,
					counterparty: {
						id: contact.id,
						name: contact.name,
						label: contact.label,
						deviceId: null,
						phone: null,
						email: null,
					},
				},
			});

			router.push(`/#${lnInvoice}`);
		},
		[
			evolu,
			router,
			contactAccount,
			account.device.id,
			contact.id,
			contact.label,
			contact.name,
		],
	);

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-8"} />
			<FadeHeader title={t("client:page.sendPayment")} />

			<SendOrReceivePayment variant={"send"} onSubmit={save} />
		</div>
	);
}
