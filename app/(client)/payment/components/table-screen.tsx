import { createId, createRandomBytes } from "@evolu/common";
import { BigNumber } from "bignumber.js";
import { motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { SquircleDashedIcon } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { BillItemList } from "@/app/(client)/bill-item-list";
import {
	createSelectedItemsAtom,
	createSelectedTipAtom,
	type SelectedItemsAtom,
	type SelectedTipAtom,
} from "@/app/(client)/bill-utils";
import { TipSelector } from "@/components/tip-selector";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SelectButton } from "@/components/ui/select-button";
import type { BillPaymentOption, ScreenData } from "@/lib/bill/driver";
import type { PaymentInit } from "@/lib/evolu/model/payment-progress";
import { Currency, Integer, NonNegativeInteger } from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";

const PayButton: FC<{
	screen: Extract<
		ScreenData,
		{
			variant: "table";
		}
	>;
	selectedItemsAtom: SelectedItemsAtom;
	selectedTipAtom: SelectedTipAtom;
}> = (props) => {
	const { t } = useTranslation();
	const [paymentMethod, setPaymentMethod] = useState<BillPaymentOption | null>(
		"btcLn",
	);
	const selectedItems = useAtomValue(props.selectedItemsAtom);
	const selectedTip = useAtomValue(props.selectedTipAtom);

	const itemsAmount =
		props.screen.payload.bill !== null
			? props.screen.payload.bill.items.reduce((acc, item) => {
					const quantity =
						item.optionality === undefined
							? item.quantity
							: Math.min(
									selectedItems[item.id] ?? item.optionality.checked,
									item.quantity,
								);

					return acc.plus(
						new BigNumber(item.item.price).times(quantity).integerValue(),
					);
				}, new BigNumber(0))
			: new BigNumber(0);
	const totalAmount = itemsAmount
		.times(new BigNumber(1).plus(new BigNumber(selectedTip).div(100)))
		.integerValue();

	return (
		<>
			<SelectButton
				value={paymentMethod}
				onValueChange={setPaymentMethod}
				options={[
					{
						value: "btcLn",
						label: t("client:paymentPage.methods.btcLightning"),
					},
					{
						value: "bankTransferCZ",
						label: t("client:paymentPage.methods.bankTransfer"),
					},
				]}
				size={"lg"}
				className={"h-12 flex-1"}
			/>
			<Button
				className={"h-12 w-60"}
				size={"lg"}
				disabled={totalAmount.eq(0)}
				onClick={async () => {
					if (paymentMethod === null) {
						return;
					}

					const bill = props.screen.payload.bill;
					if (bill === null) {
						return;
					}

					const items: PaymentInit["items"] = [];

					for (const item of bill.items) {
						const quantity =
							item.optionality === undefined
								? item.quantity
								: Math.min(
										selectedItems[item.id] ?? item.optionality.checked,
										item.quantity,
									);

						if (quantity <= 0) {
							continue;
						}

						items.push({
							id: item.id,
							price: item.item.price,
							label: item.item.label,
							quantity: quantity,
						});
					}

					if (items.length === 0) {
						return;
					}

					const paymentInit: PaymentInit = {
						paymentId: createId({
							randomBytes: createRandomBytes(),
						}),
						items,
						tip: NonNegativeInteger(
							totalAmount.times(selectedTip).div(100).integerValue().toNumber(),
						),
						currency: bill.currency,
						merchant: props.screen.payload.merchant,
						paymentOption: {
							type: paymentMethod,
						},
					};

					await props.screen.pay(paymentInit);
				}}
			>
				{totalAmount.gte(0)
					? t("client:paymentPage.actions.pay")
					: t("client:paymentPage.actions.refund")}
				<motion.span
					key={`${totalAmount} ${props.screen.payload.bill?.currency}`}
					initial={{ scale: 1.1, opacity: 0.5 }}
					animate={{ scale: 1, opacity: 1 }}
				>
					{formatMoney({
						value: Integer(totalAmount.integerValue().toNumber()),
						currency: props.screen.payload.bill?.currency ?? Currency.USD,
					})}
				</motion.span>
			</Button>
		</>
	);
};

export const TableScreen: FC<{
	screen: Extract<
		ScreenData,
		{
			variant: "table";
		}
	>;
}> = (props) => {
	const { t } = useTranslation();
	const [selectedItemsAtom] = useState(createSelectedItemsAtom);
	const [selectedTipAtom] = useState(createSelectedTipAtom);

	return (
		<>
			<div className={"mb-28 flex flex-col grow"}>
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

				<div className={"z-10"}>
					<BillItemList
						bill={props.screen.payload.bill}
						selectedItemsAtom={selectedItemsAtom}
					/>
				</div>
			</div>

			<div
				className={
					"bg-card rounded-t-2xl w-full max-w-xl shadow-2xl fixed bottom-0"
				}
				style={{
					paddingBottom: "env(safe-area-inset-bottom)",
				}}
			>
				<Collapsible open={true}>
					<CollapsibleContent>
						<div className={"flex flex-col gap-4 shadow-2xl p-4"}>
							<div className={"flex flex-col gap-4"}>
								{props.screen.payload.bill &&
									props.screen.payload.bill.allowTip === true && (
										<div
											className={
												"text-xs text-muted-foreground font-bold flex flex-col gap-2"
											}
										>
											<span className={"uppercase"}>
												{t("client:bill.tipForStaff")}
											</span>
											<TipSelector selectedTipAtom={selectedTipAtom} />
										</div>
									)}
								<div className={"flex gap-2"}>
									<ButtonGroup className={"w-full"}>
										<PayButton
											screen={props.screen}
											selectedItemsAtom={selectedItemsAtom}
											selectedTipAtom={selectedTipAtom}
										/>
									</ButtonGroup>
								</div>
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</div>
		</>
	);
};
