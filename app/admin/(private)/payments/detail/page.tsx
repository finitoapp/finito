"use client";

import { getOrThrow, type Id, sqliteTrue } from "@evolu/common";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { useMutation } from "@tanstack/react-query";
import {
	BitcoinIcon,
	CoinsIcon,
	DownloadIcon,
	ExternalLink,
	FocusIcon,
	LoaderCircleIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { type FC, useRef } from "react";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { useNostr } from "@/hooks/use-nostr";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { generateCzechBankQrCode } from "@/lib/czech-bank-qr-generator";
import { shareImageOrDownload } from "@/lib/file-utils";
import { formatAmount } from "@/lib/format-utils";
import { clientBaseUrl } from "@/lib/window-utils";
import { PaymentStatus } from "@/storages/payment-status-storage";

const StatusButton: FC<{
	paymentId: Id;
}> = (props) => {
	const evolu = useEvolu();
	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentStatus")
				.select(["paymentStatus.status as status"] as const)
				.where("paymentStatus.isDeleted", "is not", sqliteTrue)
				.where("paymentStatus.id", "=", props.paymentId),
		[props.paymentId],
	);
	const { data: paymentStatusRows } = useEvoluQuery(query);

	const value = paymentStatusRows?.[0]?.status ?? null;

	const markAsPaid = async () => {
		getOrThrow(
			evolu.upsert("paymentStatus", {
				id: props.paymentId,
				status:
					value === null || value === PaymentStatus.Unpaid
						? PaymentStatus.Paid
						: PaymentStatus.Unpaid,
				proveType:
					value === null || value === PaymentStatus.Unpaid ? "cash" : null,
			}),
		);
	};

	return (
		<Button variant={"outline"} className={"w-full"} onClick={markAsPaid}>
			<CoinsIcon />
			{value === null || value === "unpaid" ? "Mark as paid" : "Remove payment"}
		</Button>
	);
};

const FullscreenQrPayment: FC<{
	frontendUrl: string;
	lnInvoice: string | undefined;
	czechQRCode: string | undefined;
	isPaid: boolean;
}> = ({ frontendUrl, lnInvoice, czechQRCode, isPaid }) => {
	const searchParams = useSearchParams();
	const isOpen = searchParams.get("focus") === "true";
	const id = searchParams.get("id") ?? "";
	const router = useRouter();
	const tab = searchParams.get("tab");

	return (
		<>
			<Button variant={"outline"} className={"w-full"} asChild>
				<Link
					href={`?id=${encodeURIComponent(id)}&focus=true${tab !== null ? `&tab=${encodeURIComponent(tab)}` : ""}`}
					scroll={false}
				>
					<FocusIcon />
					Show fullscreen QR payment
				</Link>
			</Button>

			<Dialog
				open={isOpen}
				onOpenChange={() =>
					router.replace(
						`/admin/payments/detail?id=${encodeURIComponent(id)}${tab !== null ? `&tab=${encodeURIComponent(tab)}` : ""}`,
						{
							scroll: false,
						},
					)
				}
			>
				<DialogContent
					variant={"fullscreen"}
					style={{
						top: "env(safe-area-inset-top)",
						bottom: "env(safe-area-inset-bottom)",
					}}
				>
					<div>
						<DialogHeader>
							<DialogTitle>Payment</DialogTitle>
						</DialogHeader>

						{isPaid ? (
							<div className={"h-full w-full flex justify-center"}>
								<LoadingIndicator
									text={"The payment is successfully paid"}
									open={true}
									status={"success"}
								/>
							</div>
						) : (
							<Tabs value={tab ?? "web"} className="h-full">
								<TabsList>
									<TabsTrigger
										value="web"
										onClick={() =>
											router.replace(
												`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true`,
												{
													scroll: false,
												},
											)
										}
									>
										Web payment
									</TabsTrigger>
									{lnInvoice && (
										<TabsTrigger
											value="ln"
											onClick={() =>
												router.replace(
													`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true&tab=ln`,
													{
														scroll: false,
													},
												)
											}
										>
											BTC LN payment
										</TabsTrigger>
									)}
									{czechQRCode && (
										<TabsTrigger
											value="bankTransferCZ"
											onClick={() =>
												router.replace(
													`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true&tab=bankTransferCZ`,
													{
														scroll: false,
													},
												)
											}
										>
											CZ QR Payment
										</TabsTrigger>
									)}
								</TabsList>
								<TabsContent value="web" className={"h-full"}>
									<ResponsiveCard className={"h-full flex"}>
										<CardContent className={"flex"}>
											<div className={"flex flex-1 flex-col gap-2"}>
												<div
													className={
														"rounded h-full flex justify-center items-center"
													}
												>
													<QRCodeSVG
														size={512}
														value={frontendUrl}
														marginSize={2}
													/>
												</div>
											</div>
										</CardContent>
									</ResponsiveCard>
								</TabsContent>
								{lnInvoice && (
									<TabsContent value="ln" className={"h-full"}>
										<ResponsiveCard className={"h-full flex"}>
											<CardContent className={"flex"}>
												<div className={"flex flex-1 flex-col gap-2"}>
													<div
														className={
															"rounded h-full flex justify-center items-center"
														}
													>
														<QRCodeSVG
															size={512}
															value={lnInvoice}
															marginSize={2}
														/>
													</div>
												</div>
											</CardContent>
										</ResponsiveCard>
									</TabsContent>
								)}
								{czechQRCode && (
									<TabsContent value="bankTransferCZ" className={"h-full"}>
										<ResponsiveCard className={"h-full flex"}>
											<CardContent className={"flex"}>
												<div className={"flex flex-1 flex-col gap-2"}>
													<div
														className={
															"rounded h-full flex justify-center items-center"
														}
													>
														<QRCodeSVG
															size={512}
															value={czechQRCode}
															marginSize={2}
														/>
													</div>
												</div>
											</CardContent>
										</ResponsiveCard>
									</TabsContent>
								)}
							</Tabs>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};

export default function Home() {
	const searchParams = useSearchParams();
	const { ndk } = useNostr();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const id = searchParams.get("id");
	const tab = searchParams.get("tab");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const czechQRCodeRef = useRef<HTMLCanvasElement>(null);

	const paymentId = id as Id;
	const paymentQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("payment")
				.leftJoin("paymentLnZap", "paymentLnZap.id", "payment.id")
				.leftJoin("paymentLnSpark", "paymentLnSpark.id", "payment.id")
				.leftJoin(
					"paymentBankTransferCZ",
					"paymentBankTransferCZ.id",
					"payment.id",
				)
				.leftJoin("paymentCash", "paymentCash.id", "payment.id")
				.select([
					"payment.id as id",
					"payment.type as type",
					"payment.webPaymentEventId as webPaymentEventId",
					"payment.privateKey as privateKey",
					"payment.billCurrency as billCurrency",
					"payment.billAllowTip as billAllowTip",
					"payment.merchantName as merchantName",
					"payment.onSuccessfulPaymentRedirectUrl as onSuccessfulPaymentRedirectUrl",
					"payment.createdAt as createdAt",
					"paymentLnZap.lnInvoice as lnZapLnInvoice",
					"paymentLnZap.walletPubkey as lnZapWalletPubkey",
					"paymentLnZap.expirationIn as lnZapExpirationIn",
					"paymentLnSpark.accountId as lnSparkAccountId",
					"paymentLnSpark.lnInvoice as lnSparkLnInvoice",
					"paymentLnSpark.sparkInvoiceId as lnSparkSparkInvoiceId",
					"paymentLnSpark.expirationIn as lnSparkExpirationIn",
					"paymentBankTransferCZ.iban as bankTransferIban",
					"paymentBankTransferCZ.variableSymbol as bankTransferVariableSymbol",
					"paymentCash.id as cashId",
				] as const)
				.where("payment.isDeleted", "is not", sqliteTrue)
				.where("payment.id", "=", paymentId),
		[paymentId],
	);
	const paymentBillItemsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentBillItem")
				.select([
					"paymentBillItem.label as label",
					"paymentBillItem.price as price",
					"paymentBillItem.quantity as quantity",
				] as const)
				.where("paymentBillItem.isDeleted", "is not", sqliteTrue)
				.where("paymentBillItem.paymentId", "=", paymentId),
		[paymentId],
	);
	const { data: paymentRows } = useEvoluQuery(paymentQuery);
	const { data: paymentBillItemsRows } = useEvoluQuery(paymentBillItemsQuery);

	const payment = paymentRows?.[0];
	const item =
		payment &&
		payment.privateKey &&
		payment.webPaymentEventId &&
		payment.billCurrency
			? {
					id: payment.id,
					webPaymentEventId: payment.webPaymentEventId,
					privateKey: payment.privateKey,
					createdAt: payment.createdAt,
					merchant: payment.merchantName
						? { name: payment.merchantName }
						: undefined,
					onSuccessfulPayment: payment.onSuccessfulPaymentRedirectUrl
						? {
								_tag: "httpRedirect" as const,
								redirectUrl: payment.onSuccessfulPaymentRedirectUrl,
							}
						: undefined,
					bill: {
						currency: payment.billCurrency,
						allowTip: payment.billAllowTip === sqliteTrue,
						items: (paymentBillItemsRows ?? []).map((billItem) => ({
							label: billItem.label ?? "",
							price: billItem.price ?? 0,
							quantity: billItem.quantity ?? 0,
						})),
					},
					paymentOptions: [
						payment.type === "lnZap" &&
						payment.lnZapLnInvoice &&
						payment.lnZapWalletPubkey &&
						payment.lnZapExpirationIn !== null
							? {
									type: "lnZap" as const,
									lnInvoice: payment.lnZapLnInvoice,
									walletPubkey: payment.lnZapWalletPubkey,
									expirationIn: payment.lnZapExpirationIn,
								}
							: payment.type === "lnSpark" &&
									payment.lnSparkAccountId &&
									payment.lnSparkLnInvoice &&
									payment.lnSparkSparkInvoiceId &&
									payment.lnSparkExpirationIn !== null
								? {
										type: "lnSpark" as const,
										accountId: payment.lnSparkAccountId,
										lnInvoice: payment.lnSparkLnInvoice,
										sparkInvoiceId: payment.lnSparkSparkInvoiceId,
										expirationIn: payment.lnSparkExpirationIn,
									}
								: payment.type === "bankTransferCZ" &&
										payment.bankTransferIban &&
										payment.bankTransferVariableSymbol
									? {
											type: "bankTransferCZ" as const,
											iban: payment.bankTransferIban,
											variableSymbol: payment.bankTransferVariableSymbol,
										}
									: payment.type === "cash" && payment.cashId
										? { type: "cash" as const }
										: null,
					].filter((paymentOption) => paymentOption !== null),
				}
			: undefined;

	const { mutateAsync: deletePayment, isPending: isDeleting } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			const deleteEvent = new NDKEvent(ndk, {
				kind: 5,
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					["e", item.webPaymentEventId],
					["k", "4"],
				],
				content: "Deleted by user",
			});

			await deleteEvent.publish();
			getOrThrow(
				evolu.update("payment", {
					id: item.id,
					isDeleted: sqliteTrue,
				}),
			);
			router.push("/admin/payments");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deletePayment();
		},
		{
			title: "Delete payment?",
			description: "This action cannot be undone.",
			confirmText: "Delete",
			cancelText: "Cancel",
			confirmVariant: "destructive",
		},
	);

	const zapWallet =
		item &&
		item.paymentOptions.find(
			(paymentOption) =>
				paymentOption.type === "lnZap" || paymentOption.type === "lnSpark",
		);

	const paymentStatus = usePaymentStatus({ paymentId: id as Id });

	const totalAmount = item
		? item.bill.items.reduce((acc, val) => acc + val.price, 0)
		: 0;
	const czechBankTransfer =
		item &&
		item.paymentOptions.find(
			(paymentOption) => paymentOption.type === "bankTransferCZ",
		);
	const czechQRCode =
		item &&
		czechBankTransfer &&
		generateCzechBankQrCode({
			amount: totalAmount,
			currency: item.bill.currency,
			iban: czechBankTransfer.iban,
			variableSymbol: czechBankTransfer.variableSymbol,
			useInstantPayment: true,
		});

	const frontendUrl = `${clientBaseUrl}#s-${item?.privateKey}`;

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<ResponsiveCard className={"flex-2"}>
					<CardHeader>
						<CardTitle>
							{!item && <Skeleton />}
							{item?.bill.items[0]?.label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={"Price"}
									content={
										<>
											{!item && <Skeleton />}
											{item && formatAmount(totalAmount, item.bill.currency)}
										</>
									}
									className={"flex-1"}
								/>
								<StaticCard
									title={"Created at"}
									content={
										<>
											{!item && <Skeleton />}
											{item &&
												new Date(item.createdAt * 1000).toLocaleDateString()}
										</>
									}
									footer={
										item && new Date(item.createdAt * 1000).toLocaleTimeString()
									}
									className={"flex-1"}
								/>
							</div>
							<div className={"flex gap-4"}>
								<StaticCard
									title={"Expire at"}
									content={
										<>
											{!item && <Skeleton />}
											{zapWallet &&
												new Date(
													zapWallet.expirationIn * 1000,
												).toLocaleDateString()}
										</>
									}
									footer={
										zapWallet &&
										new Date(zapWallet.expirationIn * 1000).toLocaleTimeString()
									}
									className={"flex-1"}
								/>

								<StaticCard
									title={"Status"}
									content={
										<>
											{!item && <Skeleton />}
											{item &&
												(paymentStatus
													? paymentStatus === PaymentStatus.Paid
														? "Paid"
														: "Waiting"
													: "Unknown")}
										</>
									}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: "Merchant name",
												value: item?.merchant?.name ?? "-",
											},
											{
												key: "Redirect",
												value: item?.onSuccessfulPayment?.redirectUrl ?? "no",
												help: "The customer will be redirected to this address after successful payment if they use payment via the web application.",
											},
											{
												key: "Tip",
												value:
													item?.onSuccessfulPayment && item.bill.allowTip
														? "yes"
														: "no",
												help: "Static payments do not support tips",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}></div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>

				<div className={"flex-1 flex flex-col gap-10"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>Actions</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							<FullscreenQrPayment
								frontendUrl={frontendUrl}
								lnInvoice={zapWallet?.lnInvoice}
								czechQRCode={czechQRCode}
								isPaid={paymentStatus === PaymentStatus.Paid}
							/>
							{item && <StatusButton paymentId={item.id} />}
							<Button className={"w-full"} onClick={() => void onDelete()}>
								{isDeleting ? (
									<LoaderCircleIcon className="animate-spin" />
								) : (
									<Trash2Icon />
								)}
								<Trash2Icon />
								Delete
							</Button>
						</CardContent>
					</ResponsiveCard>

					{paymentStatus === PaymentStatus.Paid ? (
						<LoadingIndicator
							text={"The payment is successfully paid"}
							open={true}
							status={"success"}
							className={"mt-10"}
						/>
					) : (
						<Tabs value={tab ?? "web"} className="flex-1">
							<TabsList>
								<TabsTrigger
									value="web"
									onClick={() =>
										router.replace(
											`/admin/payments/detail?id=${encodeURIComponent(id)}`,
											{
												scroll: false,
											},
										)
									}
								>
									Web payment
								</TabsTrigger>
								{zapWallet && (
									<TabsTrigger
										value="ln"
										onClick={() =>
											router.replace(
												`/admin/payments/detail?id=${encodeURIComponent(id)}&tab=ln`,
												{
													scroll: false,
												},
											)
										}
									>
										BTC LN payment
									</TabsTrigger>
								)}
								{czechQRCode && (
									<TabsTrigger
										value="bankTransferCZ"
										onClick={() =>
											router.replace(
												`/admin/payments/detail?id=${encodeURIComponent(id)}&tab=bankTransferCZ`,
												{
													scroll: false,
												},
											)
										}
									>
										CZ QR Payment
									</TabsTrigger>
								)}
							</TabsList>
							<TabsContent value="web">
								<ResponsiveCard>
									<CardContent>
										{item && (
											<div className={"flex flex-col gap-2"}>
												<div className={"py-4 bg-white flex rounded"}>
													<QRCodeSVG
														className={"w-full"}
														size={256}
														value={frontendUrl}
													/>
												</div>
												<Textarea readOnly={true} value={frontendUrl} />
												<Button asChild>
													<a href={frontendUrl} target={"_blank"}>
														<ExternalLink />
														Open
													</a>
												</Button>
											</div>
										)}
									</CardContent>
								</ResponsiveCard>
							</TabsContent>
							{item && zapWallet && (
								<TabsContent value="ln">
									<ResponsiveCard>
										<CardContent>
											<div className={"flex flex-col gap-2"}>
												<div className={"py-4 bg-white flex rounded"}>
													<QRCodeSVG
														className={"w-full"}
														size={256}
														value={zapWallet.lnInvoice}
													/>
												</div>
												<Textarea readOnly={true} value={zapWallet.lnInvoice} />
												<Button asChild>
													<a
														href={`lightning:${zapWallet.lnInvoice}`}
														target={"_blank"}
													>
														<BitcoinIcon />
														Open in BTC wallet
													</a>
												</Button>
											</div>
										</CardContent>
									</ResponsiveCard>
								</TabsContent>
							)}
							{item && czechQRCode && (
								<TabsContent value="bankTransferCZ">
									<ResponsiveCard>
										<CardContent>
											<div className={"flex flex-col gap-2"}>
												<div className={"py-4 bg-white flex rounded"}>
													<QRCodeSVG
														className={"w-full"}
														size={256}
														value={czechQRCode}
													/>
													<QRCodeCanvas
														className={"hidden"}
														size={256}
														value={czechQRCode}
														ref={czechQRCodeRef}
														marginSize={4}
													/>
												</div>
												<Textarea readOnly={true} value={czechQRCode} />
												<Button
													onClick={async () => {
														const node = czechQRCodeRef.current;
														if (node == null) {
															return;
														}

														const mimetype = "image/jpeg";
														node.toBlob(
															async (blob) => {
																if (blob === null) {
																	return;
																}

																await shareImageOrDownload({
																	fileName: `qr-payment.jpg`,
																	mimetype,
																	blob,
																	title: "Share QR code",
																	text: "Share this QR code in your banking app",
																});
															},
															mimetype,
															0.8,
														);
													}}
												>
													<DownloadIcon />
													Download QR code
												</Button>
											</div>
										</CardContent>
									</ResponsiveCard>
								</TabsContent>
							)}
						</Tabs>
					)}
				</div>
			</div>
		</div>
	);
}
