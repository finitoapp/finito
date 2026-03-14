"use client";

import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import type { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveCard } from "@/components/responsive-card";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetQueryParam } from "@/hooks/use-set-query-parameter";

export const ReceivePayment: FC<{
	frontendUrl: string | undefined;
	lnInvoice: string | undefined;
	czechQRCode: string | undefined;
	cashTabContent?: ReactNode;
	key?: string;
}> = ({
	frontendUrl,
	lnInvoice,
	czechQRCode,
	cashTabContent,
	key = "root",
}) => {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const tab = searchParams.get(`${key}.tab`);
	const setQueryParam = useSetQueryParam();

	return (
		<Tabs value={tab ?? "web"} className="flex flex-col">
			<TabsList>
				<TabsTrigger
					value="web"
					onClick={() => setQueryParam(`${key}.tab`, null)}
				>
					{t("payments:detail.tabs.web-payment")}
				</TabsTrigger>
				{lnInvoice && (
					<TabsTrigger
						value="ln"
						onClick={() => setQueryParam(`${key}.tab`, "ln")}
					>
						{t("payments:detail.tabs.btc-ln-payment")}
					</TabsTrigger>
				)}
				{czechQRCode && (
					<TabsTrigger
						value="bankTransferCZ"
						onClick={() => setQueryParam(`${key}.tab`, "bankTransferCZ")}
					>
						{t("payments:detail.tabs.cz-qr-payment")}
					</TabsTrigger>
				)}
				{cashTabContent && (
					<TabsTrigger
						value="cash"
						onClick={() => setQueryParam(`${key}.tab`, "cash")}
					>
						{t("payments:detail.tabs.cash")}
					</TabsTrigger>
				)}
			</TabsList>
			{frontendUrl && (
				<TabsContent value="web">
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
					<Card>
						<CardContent>
							<QRCodeSVG
								className={"w-full"}
								size={512}
								value={lnInvoice}
								marginSize={2}
							/>
						</CardContent>
					</Card>
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
