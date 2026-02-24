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
import { formatAmount } from "@/lib/shared/utils/format";
import { Currency } from "@/lib/shared/types";

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

			console.log("balance", balance);

			return balance;
		},
	});

	return (
		<FadeHeader
			startAddon={null}
			endAddon={
				<Link href={"/settings"}>
					<Button type={"button"} variant={"ghost"}>
						<MenuIcon className={"text-primary"} />
					</Button>
				</Link>
			}
			title={
				<div className={"py-5"}>
					<div>
						{data !== undefined ? (
							formatAmount(Number(data) / 100000000, Currency.BTC)
						) : (
							<Skeleton className={"h-7 w-30"} />
						)}
					</div>
					<div
						className={"text-xs mt-2 pt-2.5 font-medium text-muted-foreground"}
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
			<div className={"h-26"} />
			<WalletStatus />
			<TransactionHistory />

			<div className="fixed bottom-8 left-0 right-0 flex justify-center">
				<div className="bg-background border-t rounded-full shadow-2xl transition-all duration-400 flex justify-around gap-2 relative">
					<Link href={"/receive"}>
						<Button
							type={"button"}
							variant={"dim"}
							className={"h-14 w-36 px-8 text-foreground"}
						>
							<ArrowDownIcon className={"size-5 text-primary"} />
							{t("client:home.actions.receive")}
						</Button>
					</Link>
					<Link href={"/scan"}>
						<Button
							type={"button"}
							variant={"dim"}
							className={`size-20 -m-3 bg-background border rounded-full`}
						>
							<ScanQrCodeIcon className={"size-8 text-primary"} />
						</Button>
					</Link>
					<Button
						disabled={true}
						type={"button"}
						variant={"dim"}
						className={"h-14 w-36 px-8 text-foreground"}
					>
						<ArrowUpIcon className={"size-5 text-primary"} />
						{t("client:home.actions.send")}
					</Button>
				</div>
			</div>
		</div>
	);
}
