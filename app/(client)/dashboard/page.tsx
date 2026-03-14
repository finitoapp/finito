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
import { Currency } from "@/lib/shared/types";
import { formatAmount } from "@/lib/shared/utils/format";

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
				<div className={"py-4"}>
					<div>
						{data !== undefined ? (
							formatAmount(Number(data) / 100000000, Currency.BTC)
						) : (
							<Skeleton className={"h-7 w-30"} />
						)}
					</div>
					<div
						className={"text-xs mt-1 pt-2.5 font-medium text-muted-foreground"}
					>
						{data !== undefined ? (
							formatAmount(Number(data), Currency.CZK)
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
			<div className={"h-20"} />
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
							"size-20 -my-3 -mx-8 bg-card border-t rounded-full shadow-[0_0_48px_rgba(0,0,0,0.1)] dark:shadow-[0_0_48px_rgba(0,0,0,0.4)]"
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
					<Button
						disabled={true}
						type={"button"}
						variant={"secondary"}
						className={
							"h-14 w-43 px-0 bg-transparent text-foreground rounded-r-full text-md"
						}
					>
						<ArrowUpIcon className={"size-5 text-primary"} strokeWidth={3} />
						{t("client:home.actions.send")}
					</Button>
				</div>
			</div>
		</div>
	);
}
