import { type Id, sqliteTrue } from "@evolu/common";
import { CheckIcon, LoaderCircleIcon, ReceiptIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { formatAmount, formatMoney } from "@/lib/format-utils";
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

export const TransactionHistory = () => {
	const { t } = useTranslation();
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

	const navItems =
		paymentInitRows === undefined
			? [null, null, null, null]
			: items.length === 0
				? ([false] as const)
				: items;

	return (
		<VerticalNav
			title={t("client:transactionHistory.title")}
			items={navItems.map((item, index) => {
				if (item === false) {
					return {
						disableAction: true,
						label: (
							<div
								className={
									"flex flex-col justify-center items-center gap-8 py-10"
								}
							>
								<ReceiptIcon className="h-10 w-10 text-muted-foreground" />
								<h2 className={"text-foreground text-lg"}>
									{t("client:transactionHistory.empty.title")}
								</h2>
								<p className="text-balance text-sm text-muted-foreground text-center">
									{t("client:transactionHistory.empty.description")}
								</p>
							</div>
						),
					};
				}

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
									<Skeleton className={"h-5 w-[250px]"} />
								</strong>
								<div className={"flex justify-between w-full text-xs"}>
									<span>
										<Skeleton className={"h-4 w-[20px]"} />
									</span>
									&nbsp;&nbsp;•&nbsp;&nbsp;
									<span className={"text-muted-foreground"}>
										<Skeleton className={"h-4 w-[50px]"} />
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
							<strong>
								{item.merchantName ??
									t("client:transactionHistory.unknownMerchant")}
							</strong>
							<div className={"flex justify-between w-full text-xs"}>
								<span>
									{formatMoney({
										value: totalAmount,
										currency: item.currency ?? "CZK",
									})}
								</span>
								&nbsp;&nbsp;•&nbsp;&nbsp;
								<span className={"text-muted-foreground"}>
									{new Date(item.createdAt).toLocaleString()}
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
	);
};
