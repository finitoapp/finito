"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { EditIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("transaction")
				.innerJoin("account", "account.id", "transaction.accountId")
				.leftJoin("transactionIban", "transactionIban.id", "transaction.id")
				.leftJoin("transactionLud16", "transactionLud16.id", "transaction.id")
				.leftJoin("transactionSpark", "transactionSpark.id", "transaction.id")
				.leftJoin("transactionNwc", "transactionNwc.id", "transaction.id")
				.leftJoin(
					"transactionCashRegister",
					"transactionCashRegister.id",
					"transaction.id",
				)
				.select([
					"transaction.id as id",
					"transaction._tag as _tag",
					"transaction.amount as amount",
					"transaction.occurredAt as occurredAt",
					"transaction.createdAt as createdAt",
					"transaction.note as note",
					"transaction.internalTransferGroupId as internalTransferGroupId",
					"account.name as accountName",
					"transactionIban.variableSymbol as ibanVariableSymbol",
					"transactionIban.constantSymbol as ibanConstantSymbol",
					"transactionIban.specificSymbol as ibanSpecificSymbol",
					"transactionIban.bankReference as ibanBankReference",
					"transactionLud16.lnInvoice as lud16LnInvoice",
					"transactionLud16.paymentHash as lud16PaymentHash",
					"transactionSpark.sparkTransferId as sparkTransferId",
					"transactionSpark.lnInvoice as sparkLnInvoice",
					"transactionSpark.preImage as sparkPreImage",
					"transactionSpark.paymentHash as sparkPaymentHash",
					"transactionNwc.nwcEventId as nwcEventId",
					"transactionNwc.nwcRequestId as nwcRequestId",
				] as const)
				.where("transaction.isDeleted", "is not", sqliteTrue)
				.where("transaction.id", "=", id as Id),
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items?.[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("transaction", { id: item.id, isDeleted: sqliteTrue });
			router.push("/admin/transactions");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteItem();
		},
		{
			title: t("transactions:detail.confirm-delete.title"),
			description: t("transactions:detail.confirm-delete.description"),
			confirmText: t("transactions:detail.confirm-delete.confirm"),
			cancelText: t("transactions:detail.confirm-delete.cancel"),
			confirmVariant: "destructive",
		},
	);

	const formatAmount = (amount: number | null) => {
		if (amount === null) return "-";
		return amount > 0 ? `+${amount}` : `${amount}`;
	};

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<ResponsiveCard className={"flex-2"}>
					<CardHeader>
						<CardTitle>
							{!item && <Skeleton />}
							{item?.accountName}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={t("transactions:detail.labels.type")}
									content={item?._tag ?? <Skeleton />}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: t("transactions:detail.labels.account"),
												value: item?.accountName ?? "-",
											},
											{
												key: t("transactions:detail.labels.amount"),
												value: formatAmount(item?.amount ?? null),
											},
											{
												key: t("transactions:detail.labels.occurred-at"),
												value: item?.occurredAt
													? new Date(item.occurredAt).toLocaleString()
													: "-",
											},
											{
												key: t("transactions:detail.labels.created-at"),
												value: item?.createdAt
													? new Date(item.createdAt).toLocaleString()
													: "-",
											},
											{
												key: t("transactions:detail.labels.note"),
												value: item?.note ?? "-",
											},
											{
												key: t(
													"transactions:detail.labels.internal-transfer-group-id",
												),
												value: item?.internalTransferGroupId ?? "-",
											},
											...(item?._tag === "accountIban"
												? [
														{
															key: t(
																"transactions:form.transaction-form.label.variable-symbol",
															),
															value: item.ibanVariableSymbol ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.constant-symbol",
															),
															value: item.ibanConstantSymbol ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.specific-symbol",
															),
															value: item.ibanSpecificSymbol ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.bank-reference",
															),
															value: item.ibanBankReference ?? "-",
														},
													]
												: []),
											...(item?._tag === "accountLud16"
												? [
														{
															key: t(
																"transactions:form.transaction-form.label.ln-invoice",
															),
															value: item.lud16LnInvoice ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.payment-hash",
															),
															value: item.lud16PaymentHash ?? "-",
														},
													]
												: []),
											...(item?._tag === "accountSpark" ||
											item?._tag === "transactionSpark"
												? [
														{
															key: t(
																"transactions:form.transaction-form.label.spark-transfer-id",
															),
															value: item.sparkTransferId ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.ln-invoice",
															),
															value: item.sparkLnInvoice ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.pre-image",
															),
															value: item.sparkPreImage ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.payment-hash",
															),
															value: item.sparkPaymentHash ?? "-",
														},
													]
												: []),
											...(item?._tag === "accountNwc"
												? [
														{
															key: t(
																"transactions:form.transaction-form.label.nwc-event-id",
															),
															value: item.nwcEventId ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.nwc-request-id",
															),
															value: item.nwcRequestId ?? "-",
														},
													]
												: []),
										]}
									/>
								</div>
								<div className={"flex-1"}></div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>

				<div className={"flex-1 flex flex-col gap-4"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>{t("common:table.actions")}</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link
									href={`/admin/transactions/edit?id=${encodeURIComponent(id)}`}
								>
									<EditIcon />
									{t("transactions:detail.actions.edit")}
								</Link>
							</Button>
							<Button className={"w-full"} onClick={() => void onDelete()}>
								<Trash2Icon />
								{t("transactions:detail.actions.delete")}
							</Button>
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}
