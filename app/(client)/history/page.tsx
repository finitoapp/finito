"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { CheckIcon, LoaderCircleIcon, ReceiptIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { FadeHeader } from "@/components/fade-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { formatAmount } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

type InitItem = {
	id: Id;
	createdAt: number;
	currency: string | null;
	tip: number | null;
	merchantName: string | null;
	items: Array<{ price: number | null; quantity: number | null }>;
};

const PaymentStatus: FC<{
	paymentId: Id;
}> = (props) => {
	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentFinished")
				.select(["paymentFinished.type as type"] as const)
				.where("paymentFinished.isDeleted", "is not", sqliteTrue)
				.where("paymentFinished.id", "=", props.paymentId)
				.limit(1),
		[props.paymentId],
	);
	const { data: rows } = useEvoluQuery(query);

	const [className, icon] = (() => {
		if (rows === undefined) {
			return ["", <LoaderCircleIcon key={1} className="animate-spin size-4" />];
		}
		if (rows[0]?.type === "success") {
			return ["bg-green-500", <CheckIcon key={1} className="size-4" />];
		}
		return ["bg-red-700", <XIcon key={1} className="size-4" />];
	})();

	return (
		<div
			className={cn(
				"h-6 w-6 rounded-full flex items-center justify-center",
				className,
			)}
		>
			{icon}
		</div>
	);
};

export default function Page() {
	const paymentInitQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentInit")
				.select([
					"paymentInit.id as id",
					"paymentInit.createdAt as createdAt",
					"paymentInit.currency as currency",
					"paymentInit.tip as tip",
					"paymentInit.merchantName as merchantName",
				] as const)
				.where("paymentInit.isDeleted", "is not", sqliteTrue)
				.orderBy("paymentInit.createdAt", "desc")
				.limit(20),
		[],
	);
	const paymentInitItemQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentInitItem")
				.select([
					"paymentInitItem.paymentInitId as paymentInitId",
					"paymentInitItem.price as price",
					"paymentInitItem.quantity as quantity",
				] as const)
				.where("paymentInitItem.isDeleted", "is not", sqliteTrue),
		[],
	);
	const { data: paymentInitRows } = useEvoluQuery(paymentInitQuery);
	const { data: paymentInitItemRows } = useEvoluQuery(paymentInitItemQuery);

	const items: InitItem[] =
		paymentInitRows?.map((row) => ({
			id: row.id,
			createdAt: row.createdAt,
			currency: row.currency,
			tip: row.tip,
			merchantName: row.merchantName,
			items: (paymentInitItemRows ?? []).filter(
				(item) => item.paymentInitId === row.id,
			),
		})) ?? [];

	const itemsForNav: Array<InitItem | null> =
		paymentInitRows === undefined ? [null, null, null, null] : items;

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-20"} />
			<FadeHeader title={"Payment history"} />

			{paymentInitRows !== undefined && items.length === 0 && (
				<div
					className={"h-full flex flex-col justify-center items-center gap-8"}
				>
					<ReceiptIcon className="h-12 w-12 text-muted-foreground" />
					<h2 className={"text-foreground text-lg"}>
						Your payment history is empty
					</h2>
					<p className="text-balance text-sm text-muted-foreground text-center">
						Your payment transactions will appear here once you make your first
						purchase.
					</p>
					<div className={"h-20"}></div>
				</div>
			)}

			<VerticalNav
				items={itemsForNav.map((item, index) => {
					if (item === null) {
						return {
							className:
								index === 1
									? "opacity-70"
									: index === 2
										? "opacity-50"
										: index === 3
											? "opacity-25"
											: index === 4
												? "opacity-15"
												: undefined,
							label: (
								<div className={cn("flex flex-col gap-2 items-start w-max")}>
									<strong>
										<Skeleton className={"h-5 w-62.5"} />
									</strong>
									<div className={"flex justify-between w-full text-xs"}>
										<span>
											<Skeleton className={"h-4 w-5"} />
										</span>
										&nbsp;&nbsp;•&nbsp;&nbsp;
										<span className={"text-muted-foreground"}>
											<Skeleton className={"h-4 w-12.5"} />
										</span>
									</div>
								</div>
							),
							icon: <Skeleton className="h-10 w-10 p-2" />,
						};
					}

					const totalAmount =
						item.items.reduce(
							(acc, value) => acc + (value.price ?? 0) * (value.quantity ?? 0),
							0,
						) + (item.tip ?? 0);

					return {
						label: (
							<div className={"flex flex-col gap-2 items-start w-max"}>
								<strong>{item.merchantName ?? "Unknown merchant"}</strong>
								<div className={"flex justify-between w-full text-xs"}>
									<span>
										{formatAmount(totalAmount, item.currency ?? "CZK")}
									</span>
									&nbsp;&nbsp;•&nbsp;&nbsp;
									<span className={"text-muted-foreground"}>
										{new Date(item.createdAt * 1000).toLocaleString()}
									</span>
								</div>
							</div>
						),
						icon: (
							<div className={"p-2"}>
								<PaymentStatus paymentId={item.id} />
							</div>
						),
						nextLink: `/history/detail?id=${encodeURIComponent(item.id)}`,
					};
				})}
			/>

			<div></div>
		</div>
	);
}
