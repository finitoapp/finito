"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { EditIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { createGetTransactionQuery } from "@/lib/evolu/queries/transaction";
import { formatMoney } from "@/lib/shared/utils/format";

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

	const query = useMemo(
		() =>
			createGetTransactionQuery({
				id: id as Id,
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("transaction", { id: item.id, isDeleted: sqliteTrue });
			router.push("/admin/payments/transactions");
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

	if (item === undefined) {
		return null;
	}

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
							{item.account.name}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={t("transactions:detail.labels.type")}
									content={item._tag ?? <Skeleton />}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: t("transactions:detail.labels.account"),
												value: item.account.name,
											},
											{
												key: t("transactions:detail.labels.amount"),
												value: formatMoney({
													value: item.amount,
													currency: item.currency,
												}),
											},
											{
												key: t("transactions:detail.labels.occurred-at"),
												value: new Date(item.occurredAt).toLocaleString(),
											},
											{
												key: t("transactions:detail.labels.created-at"),
												value: new Date(item.createdAt).toLocaleString(),
											},
											{
												key: t("transactions:detail.labels.note"),
												value: item.note ?? "-",
											},
											{
												key: t(
													"transactions:detail.labels.internal-transfer-group-id",
												),
												value: item.internalTransferGroupId ?? "-",
											},
											...(item.transactionIban
												? [
														{
															key: t(
																"transactions:form.transaction-form.label.variable-symbol",
															),
															value: item.transactionIban.variableSymbol ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.constant-symbol",
															),
															value: item.transactionIban.constantSymbol ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.specific-symbol",
															),
															value: item.transactionIban.specificSymbol ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.bank-reference",
															),
															value: item.transactionIban.bankReference ?? "-",
														},
													]
												: []),
											...(item.transactionLud16
												? [
														{
															key: t(
																"transactions:form.transaction-form.label.ln-invoice",
															),
															value: item.transactionLud16.lnInvoice ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.payment-hash",
															),
															value: item.transactionLud16.paymentHash ?? "-",
														},
													]
												: []),
											...(item.transactionSpark
												? [
														{
															key: t(
																"transactions:form.transaction-form.label.spark-transfer-id",
															),
															value:
																item.transactionSpark.sparkTransferId ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.ln-invoice",
															),
															value: item.transactionSpark.lnInvoice ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.pre-image",
															),
															value: item.transactionSpark.preImage ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.payment-hash",
															),
															value: item.transactionSpark.paymentHash ?? "-",
														},
													]
												: []),
											...(item.transactionNwc
												? [
														{
															key: t(
																"transactions:form.transaction-form.label.nwc-event-id",
															),
															value: item.transactionNwc.nwcEventId ?? "-",
														},
														{
															key: t(
																"transactions:form.transaction-form.label.nwc-request-id",
															),
															value: item.transactionNwc.nwcRequestId ?? "-",
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
							<Button
								variant={"outline"}
								className={"w-full"}
								nativeButton={false}
								render={
									<Link
										href={`/admin/payments/transactions/edit?id=${encodeURIComponent(id)}`}
									/>
								}
							>
								<EditIcon />
								{t("transactions:detail.actions.edit")}
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
