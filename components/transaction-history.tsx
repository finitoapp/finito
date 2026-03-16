import { CheckIcon, ReceiptIcon, XIcon } from "lucide-react";
import type { FC, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { PaymentStatus } from "@/lib/evolu/model/payment-status";
import { getLatestPayments } from "@/lib/evolu/queries/payment";
import { resolvePaymentStatus } from "@/lib/payment/service";
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
						<div className={"flex flex-col gap-2 items-start w-max"}>
							<strong>
								{t("client:transactionHistory.unknownCounterparty")}
							</strong>
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
