"use client";

import { createId, createRandomBytes } from "@evolu/common";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { type ComponentProps, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { accountAtom } from "@/atoms/account";
import { FadeHeader } from "@/components/fade-header";
import { SendOrReceivePayment } from "@/components/send-or-receive-payment";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";
import { createPayment } from "@/lib/payment/service";
import { Currency } from "@/lib/shared/types";

export default function Page() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { ndk } = useNostr();
	const router = useRouter();
	const account = useAtomValue(accountAtom);

	const save = useCallback<
		ComponentProps<typeof SendOrReceivePayment>["onSubmit"]
	>(
		async (props) => {
			const id = await createPayment({ evolu, ndk })({
				totalAmount: props.satsAmount,
				tipAmount: null,
				payment: {
					id: createId({
						randomBytes: createRandomBytes(),
					}),
					deviceId: account.device.id,
					currency: Currency.BTC,
				},
				paymentLnSpark: {
					accountId: props.paymentLnSpark.selectedAccountId,
					amount: props.satsAmount,
				},
			});
			router.push(
				`/history/detail/receive?id=${encodeURIComponent(id)}&tab=ln`,
			);
		},
		[evolu, ndk, router, account.device.id],
	);

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-8"} />
			<FadeHeader title={t("client:page.receivePayment")} />

			<SendOrReceivePayment variant={"receive"} onSubmit={save} />
		</div>
	);
}
