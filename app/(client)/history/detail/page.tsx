"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { DownloadIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FadeHeader } from "@/components/fade-header";
import { KeyValueList } from "@/components/key-value-list";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { formatAmount } from "@/lib/format-utils";

export default function Page() {
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) throw Promise.reject();

	const paymentId = id as Id;

	const paymentInitQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentInit")
				.select([
					"paymentInit.id as id",
					"paymentInit.createdAt as createdAt",
					"paymentInit.tip as tip",
					"paymentInit.currency as currency",
					"paymentInit.merchantName as merchantName",
					"paymentInit.merchantPhone as merchantPhone",
				] as const)
				.where("paymentInit.isDeleted", "is not", sqliteTrue)
				.where("paymentInit.id", "=", paymentId)
				.limit(1),
		[paymentId],
	);
	const paymentInitItemQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentInitItem")
				.select([
					"paymentInitItem.itemId as itemId",
					"paymentInitItem.price as price",
					"paymentInitItem.quantity as quantity",
				] as const)
				.where("paymentInitItem.isDeleted", "is not", sqliteTrue)
				.where("paymentInitItem.paymentInitId", "=", paymentId),
		[paymentId],
	);
	const paymentReadyQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentReady")
				.select([
					"paymentReady.billTip as billTip",
					"paymentReady.billCurrency as billCurrency",
				] as const)
				.where("paymentReady.isDeleted", "is not", sqliteTrue)
				.where("paymentReady.id", "=", paymentId)
				.limit(1),
		[paymentId],
	);
	const paymentReadyItemQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentReadyItem")
				.select([
					"paymentReadyItem.itemId as itemId",
					"paymentReadyItem.label as label",
				] as const)
				.where("paymentReadyItem.isDeleted", "is not", sqliteTrue)
				.where("paymentReadyItem.paymentReadyId", "=", paymentId),
		[paymentId],
	);
	const paymentFinishedQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentFinished")
				.select([
					"paymentFinished.type as type",
					"paymentFinished.reason as reason",
				] as const)
				.where("paymentFinished.isDeleted", "is not", sqliteTrue)
				.where("paymentFinished.id", "=", paymentId)
				.limit(1),
		[paymentId],
	);

	const { data: paymentInitRows } = useEvoluQuery(paymentInitQuery);
	const { data: paymentInitItemRows } = useEvoluQuery(paymentInitItemQuery);
	const { data: paymentReadyRows } = useEvoluQuery(paymentReadyQuery);
	const { data: paymentReadyItemRows } = useEvoluQuery(paymentReadyItemQuery);
	const { data: paymentFinishedRows } = useEvoluQuery(paymentFinishedQuery);

	const paymentInit = paymentInitRows?.[0];
	const paymentReady = paymentReadyRows?.[0];
	const paymentFinished = paymentFinishedRows?.[0];

	const totalAmount =
		(paymentInitItemRows?.reduce(
			(acc, value) => acc + (value.price ?? 0) * (value.quantity ?? 0),
			0,
		) ?? 0) + (paymentInit?.tip ?? 0);

	const readyItemLabels = new Map(
		(paymentReadyItemRows ?? []).map((item) => [item.itemId, item.label]),
	);

	return (
		<div className="space-y-8 w-full">
			<div className={"h-20"} />
			<FadeHeader title={"Payment detail"} />

			<LoadingIndicator
				text={
					paymentFinishedRows === undefined
						? "loading"
						: paymentFinished
							? paymentFinished.type === "success"
								? "Paid"
								: (paymentFinished.reason ?? "Failed")
							: "Still in progress or expired"
				}
				open={true}
				status={
					paymentFinishedRows === undefined
						? "loading"
						: paymentFinished
							? paymentFinished.type === "success"
								? "success"
								: "failure"
							: "failure"
				}
			/>

			<ResponsiveCard>
				<CardContent>
					<KeyValueList
						items={[
							{
								key: "Name",
								value: paymentInit ? (
									paymentInit.merchantName
								) : (
									<Skeleton className={"h-5 w-50"} />
								),
							},
							{
								key: "Phone",
								value: paymentInit ? (
									(paymentInit.merchantPhone ?? "-")
								) : (
									<Skeleton className={"h-5 w-50"} />
								),
							},
						]}
					/>
				</CardContent>
			</ResponsiveCard>

			<ResponsiveCard>
				<CardContent>
					<KeyValueList
						items={[
							{
								key: "Spending",
								value: paymentInit ? (
									formatAmount(totalAmount, paymentInit.currency ?? "CZK")
								) : (
									<Skeleton className={"h-5 w-50"} />
								),
							},
							{
								key: "Date",
								value: paymentInit ? (
									new Date(paymentInit.createdAt * 1000).toLocaleString()
								) : (
									<Skeleton className={"h-5 w-50"} />
								),
							},
						]}
					/>
				</CardContent>
			</ResponsiveCard>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>Bill items</CardTitle>
				</CardHeader>
				<CardContent>
					<KeyValueList
						items={(paymentInitItemRows ?? []).map((item) => ({
							key: `${item.quantity ?? 0}× ${readyItemLabels.get(item.itemId ?? "") ?? item.itemId ?? "-"}`,
							value: formatAmount(
								(item.quantity ?? 0) * (item.price ?? 0),
								paymentReady?.billCurrency ?? paymentInit?.currency ?? "CZK",
							),
						}))}
					/>
				</CardContent>
			</ResponsiveCard>

			<div className={"flex justify-center px-4"}>
				<Button className={"w-full"} type={"button"}>
					<DownloadIcon />
					Download receipt
				</Button>
			</div>

			<div className={"h-0"}></div>
		</div>
	);
}
