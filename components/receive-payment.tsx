"use client";

import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import type { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClipboard } from "@/components/use-clipboard";
import { useSetQueryParam } from "@/hooks/use-set-query-parameter";
import type { Currency, Integer } from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";

export const ReceivePayment: FC<{
	frontendUrl: string | undefined;
	lnInvoice: string | undefined;
	czechQRCode: string | undefined;
	cashTabContent?: ReactNode;
	key?: string;
	totalAmount: Integer;
	currency: Currency;
	note?: string;
}> = ({
	frontendUrl,
	lnInvoice,
	czechQRCode,
	cashTabContent,
	key,
	totalAmount,
	currency,
	note,
}) => {
	const finalKey = key ? `${key}.` : "";
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const tab = searchParams.get(`${finalKey}tab`);
	const setQueryParam = useSetQueryParam();
	const { copy } = useClipboard();

	return (
		<Tabs value={tab ?? "web"} className="flex flex-col justify-start">
			<TabsList>
				<TabsTrigger
					value="web"
					onClick={() => setQueryParam(`${finalKey}tab`, null)}
				>
					{t("payments:detail.tabs.web-payment")}
				</TabsTrigger>
				{lnInvoice && (
					<TabsTrigger
						value="ln"
						onClick={() => setQueryParam(`${finalKey}tab`, "ln")}
					>
						{t("payments:detail.tabs.btc-ln-payment")}
					</TabsTrigger>
				)}
				{czechQRCode && (
					<TabsTrigger
						value="bankTransferCZ"
						onClick={() => setQueryParam(`${finalKey}tab`, "bankTransferCZ")}
					>
						{t("payments:detail.tabs.cz-qr-payment")}
					</TabsTrigger>
				)}
				{cashTabContent && (
					<TabsTrigger
						value="cash"
						onClick={() => setQueryParam(`${finalKey}tab`, "cash")}
					>
						{t("payments:detail.tabs.cash")}
					</TabsTrigger>
				)}
			</TabsList>

			<div className={"flex flex-col items-center my-8 gap-4"}>
				<strong className={"text-2xl"}>
					{formatMoney({
						value: totalAmount,
						currency,
					})}
				</strong>

				{note && (
					<div className={"truncate w-full line-clamp-2 break-all text-xs"}>
						{note}
					</div>
				)}
			</div>

			{frontendUrl && (
				<TabsContent value="web">
					<Button>
						<QRCodeSVG size={512} value={frontendUrl} marginSize={2} />
					</Button>
					<ResponsiveCard className={"h-full flex"}>
						<CardContent className={"flex"}>
							<div className={"flex flex-1 flex-col gap-2"}>
								<div
									className={"rounded h-full flex justify-center items-center"}
								>
									<QRCodeSVG size={512} value={frontendUrl} marginSize={2} />
								</div>
							</div>
						</CardContent>
					</ResponsiveCard>
				</TabsContent>
			)}
			{lnInvoice && (
				<TabsContent value="ln">
					<Button
						className={"w-full aspect-square h-auto p-4"}
						variant={"outline"}
						onClick={() =>
							copy(lnInvoice, {
								customMessage: "LN invoice successfully copied to clipboard",
							})
						}
					>
						<QRCodeSVG
							className={"w-full h-full size-6"}
							size={512}
							value={lnInvoice}
							marginSize={2}
						/>
					</Button>
				</TabsContent>
			)}
			{czechQRCode && (
				<TabsContent value="bankTransferCZ" className={"h-full"}>
					<ResponsiveCard className={"h-full flex"}>
						<CardContent className={"flex"}>
							<div className={"flex flex-1 flex-col gap-2"}>
								<div
									className={"rounded h-full flex justify-center items-center"}
								>
									<QRCodeSVG size={512} value={czechQRCode} marginSize={2} />
								</div>
							</div>
						</CardContent>
					</ResponsiveCard>
				</TabsContent>
			)}
			{cashTabContent && (
				<TabsContent value="cash" className={"h-full"}>
					<ResponsiveCard className={"h-full flex"}>
						<CardContent className={"flex items-center justify-center"}>
							<div className={"w-full max-w-sm"}>{cashTabContent}</div>
						</CardContent>
					</ResponsiveCard>
				</TabsContent>
			)}
		</Tabs>
	);
};
