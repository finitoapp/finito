import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	ReceiptIcon,
	XIcon,
} from "lucide-react";
import type { FC, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { PaymentStatus } from "@/lib/evolu/model/payment-status";
import { getLatestPayments } from "@/lib/evolu/queries/payment";
import { resolvePaymentStatus } from "@/lib/payment/service";
import { Integer } from "@/lib/shared/types";
import { cn } from "@/lib/shared/ui/cn";
import { formatMoney } from "@/lib/shared/utils/format";

const paymentStatusData = {
	[PaymentStatus.Unpaid]: ["bg-red-700", <XIcon key={1} className="size-4" />],
	[PaymentStatus.Underpaid]: [
		"bg-red-700",
		<XIcon key={1} className="size-4" />,
	],
	[PaymentStatus.Paid]: [
		"bg-green-500",
		<CheckIcon key={1} className="size-4" />,
	],
	[PaymentStatus.Overpaid]: [
		"bg-green-500",
		<CheckIcon key={1} className="size-4" />,
	],
} satisfies Record<PaymentStatus, [string, ReactElement]>;

const PaymentStatusIcon: FC<{
	paymentStatus: PaymentStatus;
}> = (props) => {
	const [className, icon] = paymentStatusData[props.paymentStatus];

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
	const { data: items } = useEvoluQuery(getLatestPayments);

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
						<div className={"flex gap-2 justify-between"}>
							<div className={"flex flex-col gap-2 items-start w-max"}>
								<strong>
									{item.counterparty?.label ??
										item.counterparty?.name ??
										t("client:transactionHistory.unknownCounterparty")}
								</strong>
								<div className={"flex justify-between w-full text-xs"}>
									<span
										className={
											item.direction === "outgoing" ? "text-red-700" : undefined
										}
									>
										{formatMoney({
											value:
												item.direction === "outgoing"
													? Integer(-item.totalAmount)
													: item.totalAmount,
											currency: item.currency,
										})}
									</span>
									&nbsp;&nbsp;•&nbsp;&nbsp;
									<span className={"text-muted-foreground"}>
										{new Date(item.createdAt).toLocaleString()}
									</span>
								</div>
							</div>
							<div className={"shrink-0 flex items-center justify-center"}>
								{item.direction === "outgoing" ? (
									<ArrowUpIcon
										size={24}
										className={"inline-block mr-2 text-red-700"}
										strokeWidth={3}
									/>
								) : (
									<ArrowDownIcon
										size={24}
										className={"inline-block mr-2 text-green-500"}
										strokeWidth={3}
									/>
								)}
							</div>
						</div>
					),
					icon: (
						<div className={"p-2"}>
							<PaymentStatusIcon
								paymentStatus={resolvePaymentStatus({ payment: item })}
							/>
						</div>
					),
					nextLink: `/history/detail?id=${encodeURIComponent(item.id)}`,
				};
			})}
		/>
	);
};
