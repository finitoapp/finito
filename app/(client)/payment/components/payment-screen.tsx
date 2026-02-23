import {
	LoaderCircleIcon,
	RecycleIcon,
	SquircleDashedIcon,
} from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { BillItemList } from "@/app/(client)/bill-item-list";
import type { SelectedItemsAtom } from "@/app/(client)/bill-utils";
import { LoadingIndicator } from "@/components/loading-indicator";
import type { ScreenData } from "@/lib/bill/billDriver";
import { formatAmount, formatMoney } from "@/lib/format-utils";
import { Integer } from "@/lib/types";

export const PaymentScreen: FC<{
	screen: Extract<
		ScreenData,
		{
			variant: "paymentReady" | "paymentFinished" | "payment" | "refund";
		}
	>;
	selectedItemsAtom: SelectedItemsAtom;
}> = (props) => {
	const { t } = useTranslation();
	const totalAmount =
		props.screen && props.screen.variant === "paymentReady"
			? props.screen.payload.bill.items.reduce(
					(acc, value) =>
						acc.plus(new BigNumber(value.price).times(value.quantity)),
					new BigNumber(0),
				)
			: new BigNumber(0);

	return (
		<>
			<div className={"mb-28 flex flex-col grow"}>
				{props.screen.variant === "refund" && (
					<div
						className={
							"fixed w-xl h-full max-w-full flex justify-center items-center pb-60"
						}
					>
						<RecycleIcon
							size={300}
							className={"text-muted-foreground opacity-5"}
						/>
					</div>
				)}

				{(props.screen?.variant === "payment" ||
					props.screen?.variant === "refund") &&
					(props.screen.payload.bill === null ||
						props.screen.payload.bill.items.length === 0) && (
						<div
							className={
								"fixed w-xl h-full max-w-full flex justify-center items-center pb-60"
							}
						>
							<SquircleDashedIcon
								size={300}
								className={"text-muted-foreground opacity-5"}
							/>
						</div>
					)}

				{(props.screen.variant === "payment" ||
					props.screen.variant === "refund") &&
					props.screen.payload.table?.name && (
						<h3
							className={"text-md font-bold text-foreground m-auto py-4 px-4"}
						>
							{props.screen.payload.table.name}
						</h3>
					)}
				{(props.screen.variant === "payment" ||
					props.screen.variant === "refund") && (
					<BillItemList
						bill={props.screen.payload.bill}
						selectedItemsAtom={props.selectedItemsAtom}
					/>
				)}
				{props.screen?.variant === "paymentFinished" && (
					<div
						className={
							"w-full flex h-full flex-col items-center justify-evenly"
						}
					>
						<LoadingIndicator
							text={
								props.screen.payload.type === "failure"
									? props.screen.payload.reason
									: t("client:paymentPage.status.paymentSuccessful")
							}
							open={true}
							status={props.screen.payload.type}
						/>
					</div>
				)}

				{props.screen.variant === "paymentReady" && (
					<div
						className={
							"w-full flex h-full pb-80 flex-col items-center gap-12 justify-evenly"
						}
					>
						<div className={"flex flex-col items-center gap-4"}>
							<div className={"text-2xl"}>
								<strong>
									{formatMoney({
										value: props.screen.payload.amountExpectedToPay
											? props.screen.payload.amountExpectedToPay.value
											: Integer(totalAmount.integerValue().toNumber()),
										currency: props.screen.payload.amountExpectedToPay
											? props.screen.payload.amountExpectedToPay.currency
											: props.screen.payload.bill.currency,
									})}
								</strong>
							</div>
							{props.screen.payload.amountExpectedToPay && (
								<div className={"text-2xl"}>
									{formatMoney({
										value: Integer(totalAmount.integerValue().toNumber()),
										currency: props.screen.payload.bill.currency,
									})}
								</div>
							)}
						</div>

						{props.screen.payload.amountExpectedToPay && (
							<div className={"text-xs text-muted-foreground"}>
								{t("client:paymentPage.labels.rate")}{" "}
								{formatAmount(props.screen.payload.amountExpectedToPay.rate)}{" "}
								{props.screen.payload.amountExpectedToPay.currency}/
								{props.screen.payload.bill.currency}
							</div>
						)}

						<div className={"flex flex-col items-center gap-4"}>
							<LoaderCircleIcon className="animate-spin size-12 text-muted-foreground" />

							<div className={"text-xs text-muted-foreground"}>
								{totalAmount.gte(0)
									? t("client:paymentPage.status.waitingForPayment")
									: t("client:paymentPage.status.waitingForRefund")}
							</div>
						</div>
					</div>
				)}
			</div>
		</>
	);
};
