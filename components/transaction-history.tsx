import { type Id, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
import { CheckIcon, LoaderCircleIcon, ReceiptIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import { cn } from "@/lib/shared/ui/cn";
import { formatMoney } from "@/lib/shared/utils/format";

const PaymentStatus: FC<{
	paymentId: Id;
}> = (props) => {
	const query = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("paymentFinished")
					.select(["paymentFinished.type as type"] as const)
					.where("paymentFinished.isDeleted", "is not", sqliteTrue)
					.where("paymentFinished.id", "=", props.paymentId)
					.limit(1),
			),
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
	const paymentInitQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("payment")
					.select([
						"id",
						"createdAt",
						"totalAmount",
						"currency",
						"tipAmount",
						"direction",
					] as const)
					.where("payment.isDeleted", "is not", sqliteTrue)
					.where("payment.currency", "is not", null)
					.where("payment.totalAmount", "is not", null)
					.where("payment.direction", "is not", null)
					.orderBy("payment.createdAt", "desc")
					.limit(20)
					.$narrowType<{
						currency: NotNull;
						totalAmount: NotNull;
						direction: NotNull;
					}>(),
			),
		[],
	);

	const { data: items } = useEvoluQuery(paymentInitQuery);

	const navItems = items.length === 0 ? ([false] as const) : items;

	return (
		<VerticalNav
			title={t("client:transactionHistory.title")}
			items={navItems.map((item) => {
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

				return {
					label: (
						<div className={"flex flex-col gap-2 items-start w-max"}>
							<strong>{t("client:transactionHistory.unknownMerchant")}</strong>
							<div className={"flex justify-between w-full text-xs"}>
								<span>
									{formatMoney({
										value: item.totalAmount,
										currency: item.currency,
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
