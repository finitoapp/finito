"use client";

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
import { useNostr } from "@/hooks/use-nostr";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { generateCzechBankQrCode } from "@/lib/czech-bank-qr-generator";
import { shareImageOrDownload } from "@/lib/file-utils";
import { formatAmount } from "@/lib/format-utils";
import type { Uuid7 } from "@/lib/types";
import { clientBaseUrl } from "@/lib/window-utils";
import {
	PaymentStatus,
	paymentStatusStorage,
} from "@/storages/payment-status-storage";
import { paymentStorage } from "@/storages/payment-storage";

const StatusButton: FC<{
	paymentId: Uuid7;
}> = (props) => {
	const { ndk } = useNostr();
	const { data: invoiceStates } = useStorageSubscription(paymentStatusStorage, {
		limit: 1,
		key: props.paymentId,
	});

	const invoiceStatus = invoiceStates ? invoiceStates[0] : undefined;
	const value = invoiceStatus ? invoiceStatus.value.status : null;

	const markAsPaid = async () => {
		await paymentStatusStorage.insertOrUpdate({ ndk }, props.paymentId, {
			paymentId: props.paymentId,
			...(value === null || value === "unpaid"
				? {
						status: PaymentStatus.Paid,
						prove: {
							type: "cash",
						},
					}
				: {
						status: PaymentStatus.Unpaid,
					}),
		});
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
	const id = searchParams.get("id");
	const tab = searchParams.get("tab");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const czechQRCodeRef = useRef<HTMLCanvasElement>(null);

	const { data: items } = useStorageSubscription(paymentStorage, {
		key: id,
	});

	const item = items && items[0];

	const { mutateAsync: deletePayment, isPending: isDeleting } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			const deleteEvent = new NDKEvent(ndk, {
				kind: 5,
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					["e", item.value.webPaymentEventId],
					["k", "4"],
				],
				content: "Deleted by user",
			});

			await deleteEvent.publish();
			await paymentStorage.delete({ ndk }, item.eventId);
			router.push("/admin/payments");
		},
	});

	const zapWallet =
		item &&
		item.value.paymentOptions.find(
			(paymentOption) =>
				paymentOption.type === "lnZap" || paymentOption.type === "lnSpark",
		);

	const paymentStatus = usePaymentStatus({ paymentId: id as Uuid7 });

	const totalAmount = item
		? item.value.bill.items.reduce((acc, val) => acc + val.price, 0)
		: 0;
	const czechBankTransfer =
		item &&
		item.value.paymentOptions.find(
			(paymentOption) => paymentOption.type === "bankTransferCZ",
		);
	const czechQRCode =
		item &&
		czechBankTransfer &&
		generateCzechBankQrCode({
			amount: totalAmount,
			currency: item.value.bill.currency,
			iban: czechBankTransfer.iban,
			variableSymbol: czechBankTransfer.variableSymbol,
			useInstantPayment: true,
		});

	const frontendUrl = `${clientBaseUrl}#s-${item?.value.privateKey}`;

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
							{item?.value.bill.items[0]?.label}
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
											{item &&
												formatAmount(totalAmount, item.value.bill.currency)}
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
												value: item?.value.merchant?.name ?? "-",
											},
											{
												key: "Redirect",
												value:
													item?.value.onSuccessfulPayment?.redirectUrl ?? "no",
												help: "The customer will be redirected to this address after successful payment if they use payment via the web application.",
											},
											{
												key: "Tip",
												value:
													item?.value.onSuccessfulPayment &&
													item.value.bill.allowTip
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
							{item && <StatusButton paymentId={item.value.id} />}
							<Button className={"w-full"} onClick={() => deletePayment()}>
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
