import { type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { motion } from "framer-motion";
import { LoaderCircleIcon, SquircleDashedIcon } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SelectButton } from "@/components/ui/select-button";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import type { ScreenData } from "@/lib/bill/driver";
import { createQuery } from "@/lib/evolu";
import { createOutgoingPayment } from "@/lib/payment/service";
import { Currency, type NonEmptyString } from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";
import { extractBtcAmountFromLightningInvoice } from "@/lib/shared/utils/ln";

const btcWalletsQuery = createQuery((db) =>
	db
		.selectFrom("account")
		.select(["id", "name"] as const)
		.where("account.isDeleted", "is not", sqliteTrue)
		.where("account.name", "is not", null)
		.where("account._tag", "in", ["accountSpark", "accountNwc"])
		.$narrowType<{
			name: KyselyNotNull;
		}>(),
);

const PayButton: FC<{
	lnInvoice: NonEmptyString;
}> = (props) => {
	const { t } = useTranslation();
	const totalAmount = extractBtcAmountFromLightningInvoice(props.lnInvoice);
	const [paymentMethod, setPaymentMethod] = useState("external");
	const evolu = useEvolu();

	const { data: btcWallets } = useEvoluQuery(btcWalletsQuery);

	const options = [
		{
			value: "external",
			label: t("client:paymentPage.wallets.external"),
		},
		...btcWallets.map((btcWallet) => ({
			value: btcWallet.id,
			label: btcWallet.name,
		})),
	];

	return (
		<>
			<SelectButton
				value={paymentMethod}
				onValueChange={setPaymentMethod}
				options={options}
				size={"lg"}
				className={"h-12 flex-1"}
			/>
			<Button
				className={"h-12 w-60"}
				size={"lg"}
				disabled={false}
				onClick={async () => {
					createOutgoingPayment({
						evolu,
						payment: {
							totalAmount,
							currency: Currency.BTC,
						},
					});

					if (paymentMethod === "external") {
						const a = document.createElement("a");
						a.style.display = "none";
						a.href = `lightning:${props.lnInvoice}`;
						// a.target = "_blank";

						document.body.appendChild(a);
						a.click();
						document.body.removeChild(a);
						return;
					}
				}}
			>
				{t("client:paymentPage.actions.pay")}
				<motion.span
					key={`${totalAmount} BTC`}
					initial={{ scale: 1.1, opacity: 0.5 }}
					animate={{ scale: 1, opacity: 1 }}
				>
					{formatMoney({
						value: totalAmount,
						currency: Currency.BTC,
					})}
				</motion.span>
			</Button>
		</>
	);
};

export const PaymentScreen: FC<{
	screen: Extract<
		ScreenData,
		{
			variant: "payment";
		}
	>;
}> = (props) => {
	const { t } = useTranslation();

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

				<div
					className={
						"w-full flex h-full pb-80 flex-col items-center gap-12 justify-evenly"
					}
				>
					<div className={"flex flex-col items-center gap-4"}>
						<div className={"text-2xl"}>
							<strong>
								{formatMoney({
									value: props.screen.payload.payment.totalAmount,
									currency: props.screen.payload.payment.currency,
								})}
							</strong>
						</div>
					</div>

					<div className={"flex flex-col items-center gap-4"}>
						<LoaderCircleIcon className="animate-spin size-12 text-muted-foreground" />

						<div className={"text-xs text-muted-foreground"}>
							{t("client:paymentPage.status.waitingForPayment")}
						</div>
					</div>
				</div>
			</div>

			{props.screen.payload.payment.paymentSpecification.type ===
				"lnInvoice" && (
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
									<div className={"flex gap-2"}>
										<ButtonGroup className={"w-full"}>
											<PayButton
												lnInvoice={
													props.screen.payload.payment.paymentSpecification
														.lnInvoice
												}
											/>
										</ButtonGroup>
									</div>
								</div>
							</div>
						</CollapsibleContent>
					</Collapsible>
				</div>
			)}
		</>
	);
};
