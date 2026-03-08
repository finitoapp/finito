"use client";

import type { Id } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TransactionForm } from "@/app/admin/(private)/transactions/transaction-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetTransactionQuery } from "@/lib/evolu/queries/transaction";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(
		() =>
			createGetTransactionQuery({
				id: id as Id,
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/transactions");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className={"max-w-2xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("transactions:page.editTransaction")}</CardTitle>
				</CardHeader>
				<CardContent>
					<TransactionForm
						key={item ? "yes" : "no"}
						defaultValues={{
							...item,
							occurredAt: new Date(item.occurredAt),
							amount: moneyCodec.encode({
								value: item.amount,
								currency: item.currency,
							}).value,
							note: item.note ?? "",
							internalTransferGroupId: item.internalTransferGroupId ?? "",
							transactionIban: item.transactionIban
								? {
										...item.transactionIban,
										variableSymbol: item.transactionIban.variableSymbol ?? "",
										constantSymbol: item.transactionIban.constantSymbol ?? "",
										specificSymbol: item.transactionIban.specificSymbol ?? "",
										bankReference: item.transactionIban.bankReference ?? "",
									}
								: undefined,
							transactionLud16: item.transactionLud16
								? {
										...item.transactionLud16,
										lnInvoice: item.transactionLud16.lnInvoice ?? "",
									}
								: undefined,
							transactionSpark: item.transactionSpark ?? undefined,
							transactionNwc: item.transactionNwc
								? {
										...item.transactionNwc,
										nwcEventId: item.transactionNwc.nwcEventId ?? "",
										nwcRequestId: item.transactionNwc.nwcRequestId ?? "",
									}
								: undefined,
						}}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
