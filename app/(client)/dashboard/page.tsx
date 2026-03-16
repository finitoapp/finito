"use client";

import { SparkWallet } from "@buildonspark/spark-sdk";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	MenuIcon,
	ScanQrCodeIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { accountAtom } from "@/atoms/account";
import { FadeHeader } from "@/components/fade-header";
import { TransactionHistory } from "@/components/transaction-history";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { currencyConverter } from "@/lib/integrations/currency-converter/currency-converter";
import { Currency, Integer } from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";

const WalletStatus = () => {
	const { mnemonic } = useAtomValue(accountAtom);

	const { data } = useQuery<bigint>({
		queryKey: ["walletStatus"],
		queryFn: async () => {
			const { wallet } = await SparkWallet.initialize({
				mnemonicOrSeed: mnemonic,
				options: {
					network: "MAINNET",
				},
			});

			const { balance } = await wallet.getBalance();

			return balance;
		},
	});

	const { data: amountInFiat } = useQuery({
		queryKey: ["walletAmountInFiat"],
		queryFn: async () => {
			const amount = Integer(Math.round(Number(data)));
			if (amount === 0) {
				return amount;
			}

			return await currencyConverter.convert({
				amount: amount,
				sourceCurrency: Currency.BTC,
				targetCurrency: Currency.CZK,
			});
		},
	});

	return (
		<FadeHeader
			startAddon={null}
			endAddon={
				<Link href={"/settings"}>
					<Button type={"button"} variant={"ghost"}>
						<MenuIcon className={"text-primary size-5"} strokeWidth={3} />
					</Button>
				</Link>
			}
			title={
				<div className={"py-4 text-center"}>
					<div className={"flex justify-center"}>
						{data !== undefined ? (
							formatMoney({
								value: Integer(Math.round(Number(data))),
								currency: Currency.BTC,
							})
						) : (
							<Skeleton className={"h-7 w-30"} />
						)}
					</div>
					<div
						className={
							"text-xs mt-1 pt-2.5 font-medium text-muted-foreground flex justify-center"
						}
					>
						{amountInFiat !== null && amountInFiat !== undefined ? (
							formatMoney({
								value: Integer(Math.round(Number(amountInFiat))),
								currency: Currency.CZK,
							})
						) : (
							<Skeleton className={"h-5 w-30"} />
						)}
					</div>
				</div>
			}
		/>
	);
};

export default function Page() {
	const { t } = useTranslation();
	return (
		<div className="space-y-8 w-full p-4 flex flex-col">
			<div className={"h-18"} />
			<WalletStatus />
			<TransactionHistory />

			<div className="fixed bottom-8 left-0 right-0 flex justify-center ">
				<div className="bg-card border-t rounded-full shadow-[0_0_48px_rgba(0,0,0,0.1)] dark:shadow-[0_0_48px_rgba(0,0,0,0.6)] transition-all duration-400 flex justify-around gap-2 relative">
					<Link href={"/receive2"}>
						<Button
							type={"button"}
							variant={"default"}
							className={
								"h-14 w-43 px-0 bg-transparent pr-0 text-foreground rounded-l-full text-md"
							}
						>
							<ArrowDownIcon
								className={"size-5 text-primary"}
								strokeWidth={3}
							/>
							{t("client:home.actions.receive")}
						</Button>
					</Link>
					<div
						className={
							"z-10 size-20 -my-3 -mx-8 bg-card border-t rounded-full shadow-[0_0_48px_rgba(0,0,0,0.1)] dark:shadow-[0_0_48px_rgba(0,0,0,0.4)]"
						}
					>
						<Link href={"/scan"}>
							<Button
								type={"button"}
								variant={"default"}
								className={`size-20 bg-transparent rounded-full`}
							>
								<ScanQrCodeIcon className={"size-8 text-primary"} />
							</Button>
						</Link>
					</div>
					<Link href={"/contacts" as never}>
						<Button
							type={"button"}
							variant={"default"}
							className={
								"h-14 w-43 px-0 bg-transparent pr-0 text-foreground rounded-r-full text-md"
							}
						>
							<ArrowUpIcon className={"size-5 text-primary"} strokeWidth={3} />
							{t("client:home.actions.send")}
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
