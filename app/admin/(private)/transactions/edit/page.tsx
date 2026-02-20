"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
	formatDateTimeLocalValue,
	TransactionForm,
} from "@/app/admin/(private)/transactions/transaction-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("transaction")
				.leftJoin("transactionIban", "transactionIban.id", "transaction.id")
				.leftJoin("transactionLud16", "transactionLud16.id", "transaction.id")
				.leftJoin("transactionSpark", "transactionSpark.id", "transaction.id")
				.leftJoin("transactionNwc", "transactionNwc.id", "transaction.id")
				.select([
					"transaction.id as id",
					"transaction.accountId as accountId",
					"transaction.occurredAt as occurredAt",
					"transaction.amount as amount",
					"transaction.note as note",
					"transaction.internalTransferGroupId as internalTransferGroupId",
					"transactionIban.variableSymbol as transactionIban.variableSymbol",
					"transactionIban.constantSymbol as transactionIban.constantSymbol",
					"transactionIban.specificSymbol as transactionIban.specificSymbol",
					"transactionIban.bankReference as transactionIban.bankReference",
					"transactionLud16.lnInvoice as transactionLud16.lnInvoice",
					"transactionLud16.paymentHash as transactionLud16.paymentHash",
					"transactionSpark.sparkTransferId as transactionSpark.sparkTransferId",
					"transactionSpark.lnInvoice as transactionSpark.lnInvoice",
					"transactionSpark.preImage as transactionSpark.preImage",
					"transactionSpark.paymentHash as transactionSpark.paymentHash",
					"transactionNwc.nwcEventId as transactionNwc.nwcEventId",
					"transactionNwc.nwcRequestId as transactionNwc.nwcRequestId",
				] as const)
				.where("transaction.isDeleted", "is not", sqliteTrue)
				.where("transaction.id", "=", id as Id),
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items?.[0];

	const defaultValues =
		item === undefined
			? undefined
			: {
					...item,
					occurredAt: formatDateTimeLocalValue(new Date(item.occurredAt)),
					amount: `${item.amount}`,
				};

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
						defaultValues={defaultValues}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
