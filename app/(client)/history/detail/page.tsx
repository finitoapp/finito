"use client";

import { DownloadIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { KeyValueList } from "@/components/key-value-list";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { formatAmount } from "@/lib/format-utils";
import {
	paymentFinishedStorage,
	paymentInitStorage,
	paymentReadyStorage,
} from "@/storages/payment-progress-storage";

export default function Page() {
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const { data: items } = useStorageSubscription(paymentInitStorage, {
		key: id,
	});

	const { data: paymentReadyItems } = useStorageSubscription(
		paymentReadyStorage,
		{
			key: id,
		},
	);

	const { data: paymentFinishedItems, eose: paymentFinishedEose } =
		useStorageSubscription(paymentFinishedStorage, {
			key: id,
		});

	const paymentInit = items && items[0];
	const paymentReady = paymentReadyItems && paymentReadyItems[0];
	const paymentFinished = paymentFinishedItems && paymentFinishedItems[0];

	const totalAmount =
		(paymentInit?.value.items.reduce(
			(acc, value) => acc + value.price * value.quantity,
			0,
		) ?? 0) + (paymentInit?.value.tip ?? 0);

	const itemsById = new Map(
		paymentReady?.value.bill.items.map((item) => [item.id, item]),
	);

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<Header title={"Payment detail"} />

			<h2 className="px-4 pt-4 text-2xl font-bold text-foreground">
				{paymentInit?.value.merchant?.name}
			</h2>

			<LoadingIndicator
				text={
					paymentFinishedEose
						? paymentFinished !== undefined
							? paymentFinished.value.type === "success"
								? "Paid"
								: paymentFinished.value.reason
							: "Still in progress or expired"
						: "loading"
				}
				open={true}
				status={
					paymentFinishedEose
						? paymentFinished !== undefined
							? paymentFinished.value.type
							: "failure"
						: "loading"
				}
			/>

			<ResponsiveCard>
				<CardContent>
					<KeyValueList
						items={[
							{
								key: "Name",
								value: paymentInit ? (
									paymentInit.value.merchant?.name
								) : (
									<Skeleton className={"h-5 w-[200px]"} />
								),
							},
							{
								key: "Phone",
								value: paymentInit ? (
									(paymentInit.value.merchant?.phone ?? "-")
								) : (
									<Skeleton className={"h-5 w-[200px]"} />
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
									formatAmount(totalAmount, paymentInit.value.currency)
								) : (
									<Skeleton className={"h-5 w-[200px]"} />
								),
							},
							{
								key: "Date",
								value: paymentInit ? (
									new Date(paymentInit.createdAt * 1000).toLocaleString()
								) : (
									<Skeleton className={"h-5 w-[200px]"} />
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
						items={
							paymentInit?.value.items.map((item) => ({
								key: `${item.quantity}× ${itemsById.get(item.id)?.label ?? item.id}`,
								value: formatAmount(
									item.quantity * item.price,
									paymentInit.value.currency,
								),
							})) ?? []
						}
					/>
				</CardContent>
			</ResponsiveCard>

			<div className={"flex justify-center  px-4"}>
				<Button className={"w-full md:w-100"} type={"button"}>
					<DownloadIcon />
					Download receipt
				</Button>
			</div>

			<div className={"h-0"}></div>
		</div>
	);
}
