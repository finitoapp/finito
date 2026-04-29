"use client";

import {
	createId,
	createIdFromString,
	createRandomBytes,
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import {
	BitcoinIcon,
	CoinsIcon,
	DownloadIcon,
	ExternalLink,
	FocusIcon,
	LoaderCircleIcon,
	PauseIcon,
	PlayIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { type FC, type ReactNode, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FullscreenDialog } from "@/components/fullscreen-dialog";
import { LoadingIndicator } from "@/components/loading-indicator";
import { DownloadPaymentReceiptButton } from "@/components/payments/download-payment-receipt-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { createQuery } from "@/lib/evolu";
import { PaymentStatus } from "@/lib/evolu/model/payment-status";
import {
	PaymentWatchingStatus,
	PaymentWatchingStopReason,
	resolvePaymentWatchingStatus,
} from "@/lib/evolu/model/payment-watching-state";
import { generateCzechBankQrCode } from "@/lib/payment/czech-bank-qr-generator";
import {
	resolvePaymentStatus,
	stopPaymentWatching,
} from "@/lib/payment/service";
import { shareImageOrDownload } from "@/lib/shared/files/file-utils";
import {
	type Currency,
	type Integer,
	NonEmptyString,
} from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";
import { clientBaseUrl } from "@/lib/shared/utils/window";

const StatusButton: FC<{
	paymentId: Id;
	amount: Integer;
	currency: Currency;
	cashAccountId: Id | null;
	className?: string;
}> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const { mutateAsync: payInCash, isPending: isPayInCashPending } = useMutation(
		{
			mutationFn: async () => {
				if (props.cashAccountId === null || props.amount <= 0) {
					return;
				}

				const transactionId = createId({ randomBytes: createRandomBytes() });
				evolu.upsert("transaction", {
					id: transactionId,
					accountId: props.cashAccountId,
					_tag: "accountCashRegister",
					amount: props.amount,
					currency: props.currency,
					occurredAt: Date.now(),
					note: NonEmptyString("Manual cash register settlement"),
					internalTransferGroupId: null,
				});
				evolu.upsert("transactionCashRegister", {
					id: transactionId,
				});

				const claimId = createIdFromString(
					`reconciliationClaim:transaction:${transactionId}:payment:${props.paymentId}`,
				);
				evolu.upsert("reconciliationClaim", {
					id: claimId,
					sourceType: "transaction",
					sourceId: transactionId,
					entityType: "payment",
					entityId: props.paymentId,
					confidence: 1,
					rule: "manualCashRegisterSettlement",
					createdBy: "adminPaymentsDetail",
				});
				const claimAllocationId = createIdFromString(
					`reconciliationClaimAllocation:${claimId}:product`,
				);
				evolu.upsert("reconciliationClaimAllocation", {
					id: claimAllocationId,
					claimId,
					componentType: "product",
					amount: props.amount,
				});
			},
		},
	);
	const onPayInCash = withConfirm(
		async () => {
			await payInCash();
		},
		{
			title: t("payments:detail.confirm.pay-in-cash.title"),
			description: t("payments:detail.confirm.pay-in-cash.description"),
			confirmText: t("payments:detail.actions.pay-in-cash"),
			cancelText: t("payments:detail.actions.cancel"),
		},
	);

	return (
		<Button
			variant={"outline"}
			className={props.className}
			onClick={() => void onPayInCash()}
			disabled={
				props.cashAccountId === null || props.amount <= 0 || isPayInCashPending
			}
		>
			<CoinsIcon />
			{t("payments:detail.actions.pay-in-cash")}
		</Button>
	);
};

const PaymentWatchingToggleButton: FC<{
	paymentId: Id;
	hasPaymentWatchingState: boolean;
	verifiedAt: number | null;
	stoppedAt: number | null;
	className?: string;
}> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();

	const paymentWatchingStatus = resolvePaymentWatchingStatus({
		verifiedAt: props.verifiedAt,
		stoppedAt: props.stoppedAt,
	});
	const showButton =
		props.hasPaymentWatchingState &&
		paymentWatchingStatus !== PaymentWatchingStatus.Verified;
	const isWatching = paymentWatchingStatus === PaymentWatchingStatus.Watching;
	const canToggle =
		paymentWatchingStatus === PaymentWatchingStatus.Watching ||
		paymentWatchingStatus === PaymentWatchingStatus.Stopped;

	const { mutateAsync: toggleWatching, isPending: isTogglingWatching } =
		useMutation({
			mutationFn: async () => {
				if (paymentWatchingStatus === PaymentWatchingStatus.Watching) {
					await stopPaymentWatching({ evolu })({
						paymentId: props.paymentId,
						reason: PaymentWatchingStopReason.Manual,
					});
					return;
				}

				if (paymentWatchingStatus === PaymentWatchingStatus.Stopped) {
					evolu.upsert("paymentWatchingState", {
						id: props.paymentId,
						stoppedAt: null,
						stopReason: null,
					});
				}
			},
		});

	if (!showButton) {
		return null;
	}

	return (
		<Button
			variant={"outline"}
			className={props.className}
			disabled={!canToggle || isTogglingWatching}
			onClick={() => void toggleWatching()}
		>
			{isTogglingWatching ? (
				<LoaderCircleIcon className="animate-spin" />
			) : isWatching ? (
				<PauseIcon />
			) : (
				<PlayIcon />
			)}
			{isWatching
				? t("payments:detail.actions.stop-watching")
				: t("payments:detail.actions.resume-watching")}
		</Button>
	);
};

const FullscreenQrPayment: FC<{
	frontendUrl: string | undefined;
	lnInvoice: string | undefined;
	czechQRCode: string | undefined;
	isPaid: boolean;
	cashTabContent?: ReactNode;
}> = ({ frontendUrl, lnInvoice, czechQRCode, isPaid, cashTabContent }) => {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const isOpen = searchParams.get("focus") === "true";
	const id = searchParams.get("id") ?? "";
	const router = useRouter();
	const tab = searchParams.get("tab");

	return (
		<>
			<Button
				variant={"outline"}
				className={"w-full"}
				nativeButton={false}
				render={
					<Link
						href={`?id=${encodeURIComponent(id)}&focus=true${tab !== null ? `&tab=${encodeURIComponent(tab)}` : ""}`}
						scroll={false}
					/>
				}
			>
				<FocusIcon />
				{t("payments:detail.actions.show-fullscreen-qr-payment")}
			</Button>

			<FullscreenDialog
				title={t("payments:page.payment")}
				isOpen={isOpen}
				onOpenChange={() =>
					router.replace(
						`/admin/payments/detail?id=${encodeURIComponent(id)}${tab !== null ? `&tab=${encodeURIComponent(tab)}` : ""}`,
						{
							scroll: false,
						},
					)
				}
			>
				{isPaid ? (
					<div className={"h-full w-full flex justify-center"}>
						<LoadingIndicator
							text={t("payments:detail.messages.payment-successfully-paid")}
							open={true}
							status={"success"}
						/>
					</div>
				) : (
					<Tabs
						value={tab ?? (lnInvoice ? "ln" : "web")}
						className="flex flex-col"
					>
						<TabsList>
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
									{t("payments:detail.tabs.btc-ln-payment")}
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
									{t("payments:detail.tabs.cz-qr-payment")}
								</TabsTrigger>
							)}
							{cashTabContent && (
								<TabsTrigger
									value="cash"
									onClick={() =>
										router.replace(
											`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true&tab=cash`,
											{
												scroll: false,
											},
										)
									}
								>
									{t("payments:detail.tabs.cash")}
								</TabsTrigger>
							)}
							<TabsTrigger
								value="web"
								onClick={() =>
									router.replace(
										`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true&tab=web`,
										{
											scroll: false,
										},
									)
								}
							>
								{t("payments:detail.tabs.web-payment")}
							</TabsTrigger>
						</TabsList>
						{frontendUrl && (
							<TabsContent value="web">
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
						)}
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
													className={"w-full"}
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
				)}
			</FullscreenDialog>
		</>
	);
};

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const tab = searchParams.get("tab");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const czechQRCodeRef = useRef<HTMLCanvasElement>(null);

	const paymentId = id as Id;
	const paymentQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("payment")
					.select(
						(eb) =>
							[
								"payment.id as id",
								"payment.createdAt as createdAt",
								"payment.direction as direction",
								"payment.totalAmount as totalAmount",
								"payment.currency as currency",

								evoluJsonArrayFrom(
									eb
										.selectFrom("paymentItemLine")
										.select(
											(eb) =>
												[
													"paymentItemLine.id as id",
													"paymentItemLine.totalAmount as totalAmount",
													"paymentItemLine.quantity as quantity",

													evoluJsonObjectFrom(
														eb
															.selectFrom("item")
															.select([
																"item.label as label",
																"item.catalogItemId as catalogItemId",
															])
															.whereRef(
																"item.id",
																"=",
																"paymentItemLine.itemId",
															)
															.where("item.isDeleted", "is not", sqliteTrue)
															.where("item.label", "is not", null)
															.$narrowType<{
																label: KyselyNotNull;
															}>(),
													).as("item"),
												] as const,
										)
										.whereRef("paymentItemLine.paymentId", "=", "payment.id")
										.where("paymentItemLine.isDeleted", "is not", sqliteTrue)
										.where("paymentItemLine.id", "is not", null)
										.where("paymentItemLine.totalAmount", "is not", null)
										.where("paymentItemLine.quantity", "is not", null)
										.$narrowType<{
											id: KyselyNotNull;
											totalAmount: KyselyNotNull;
											quantity: KyselyNotNull;
											item: KyselyNotNull;
										}>(),
								).as("items"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentBankTransferCZ")
										.select(["iban", "variableSymbol"] as const)
										.whereRef("paymentBankTransferCZ.id", "=", "payment.id")
										.where(
											"paymentBankTransferCZ.isDeleted",
											"is not",
											sqliteTrue,
										)
										.where("paymentBankTransferCZ.iban", "is not", null)
										.where(
											"paymentBankTransferCZ.variableSymbol",
											"is not",
											null,
										)
										.$narrowType<{
											iban: KyselyNotNull;
											variableSymbol: KyselyNotNull;
										}>(),
								).as("paymentBankTransferCZ"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentLnZap")
										.select([
											"lnInvoice",
											"walletPubkey",
											"expirationIn",
										] as const)
										.whereRef("paymentLnZap.id", "=", "payment.id")
										.where("paymentLnZap.isDeleted", "is not", sqliteTrue)
										.where("paymentLnZap.lnInvoice", "is not", null)
										.where("paymentLnZap.walletPubkey", "is not", null)
										.where("paymentLnZap.expirationIn", "is not", null)
										.$narrowType<{
											lnInvoice: KyselyNotNull;
											walletPubkey: KyselyNotNull;
											expirationIn: KyselyNotNull;
										}>(),
								).as("paymentLnZap"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentLnSpark")
										.select(["lnInvoice", "expirationIn"] as const)
										.whereRef("paymentLnSpark.id", "=", "payment.id")
										.where("paymentLnSpark.isDeleted", "is not", sqliteTrue)
										.where("paymentLnSpark.lnInvoice", "is not", null)
										.where("paymentLnSpark.expirationIn", "is not", null)
										.$narrowType<{
											lnInvoice: KyselyNotNull;
											walletPubkey: KyselyNotNull;
											expirationIn: KyselyNotNull;
										}>(),
								).as("paymentLnSpark"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentLnNwc")
										.select(["lnInvoice", "expirationIn"] as const)
										.whereRef("paymentLnNwc.id", "=", "payment.id")
										.where("paymentLnNwc.isDeleted", "is not", sqliteTrue)
										.where("paymentLnNwc.lnInvoice", "is not", null)
										.where("paymentLnNwc.expirationIn", "is not", null)
										.$narrowType<{
											lnInvoice: KyselyNotNull;
											expirationIn: KyselyNotNull;
										}>(),
								).as("paymentLnNwc"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentCash")
										.select(["accountId"] as const)
										.whereRef("paymentCash.id", "=", "payment.id")
										.where("paymentCash.isDeleted", "is not", sqliteTrue)
										.where("paymentCash.accountId", "is not", null)
										.$narrowType<{
											accountId: KyselyNotNull;
										}>(),
								).as("paymentCash"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentWebData")
										.select(["privateKey", "webPaymentEventId"] as const)
										.whereRef("paymentWebData.id", "=", "payment.id")
										.where("paymentWebData.isDeleted", "is not", sqliteTrue)
										.where("paymentWebData.privateKey", "is not", null)
										.where("paymentWebData.webPaymentEventId", "is not", null)
										.$narrowType<{
											privateKey: KyselyNotNull;
											webPaymentEventId: KyselyNotNull;
										}>(),
								).as("paymentWebData"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentWatchingState")
										.select([
											"verifiedAt",
											"proveType",
											"transactionId",
											"stoppedAt",
											"stopReason",
										] as const)
										.whereRef("paymentWatchingState.id", "=", "payment.id")
										.where(
											"paymentWatchingState.isDeleted",
											"is not",
											sqliteTrue,
										),
								).as("paymentWatchingState"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("reconciliationClaim")
										.innerJoin(
											"reconciliationClaimAllocation",
											"reconciliationClaimAllocation.claimId",
											"reconciliationClaim.id",
										)
										.select(
											(eb) =>
												[
													eb.fn
														.sum<Integer | null>(
															"reconciliationClaimAllocation.amount",
														)
														.as("amount"),
												] as const,
										)
										.whereRef("reconciliationClaim.entityId", "=", "payment.id")
										.where(
											"reconciliationClaim.isDeleted",
											"is not",
											sqliteTrue,
										)
										.where(
											"reconciliationClaimAllocation.isDeleted",
											"is not",
											sqliteTrue,
										)
										.where("reconciliationClaim.entityType", "=", "payment"),
								).as("reconciliationClaim"),
							] as const,
					)
					.where("payment.isDeleted", "is not", sqliteTrue)
					.where("payment.direction", "is not", null)
					.where("payment.totalAmount", "is not", null)
					.where("payment.currency", "is not", null)
					.where("payment.id", "=", paymentId)
					.$narrowType<{
						direction: KyselyNotNull;
						totalAmount: KyselyNotNull;
						currency: KyselyNotNull;
						reconciliationClaim: KyselyNotNull;
					}>(),
			),
		[paymentId],
	);

	const { data: paymentRows } = useEvoluQuery(paymentQuery);

	const payment = paymentRows[0];

	const czechQRCode =
		(payment &&
			payment.paymentBankTransferCZ &&
			generateCzechBankQrCode({
				amount: payment.totalAmount / 100,
				currency: payment.currency,
				iban: payment.paymentBankTransferCZ.iban,
				variableSymbol: payment.paymentBankTransferCZ.variableSymbol,
				useInstantPayment: true,
			})) ??
		undefined;

	const frontendUrl =
		(payment &&
			payment.paymentWebData &&
			`${clientBaseUrl}#s-${payment.paymentWebData.privateKey}`) ??
		undefined;

	useEffect(() => {
		if (payment === undefined) {
			router.replace("/admin/payments");
		}
	}, [payment, router]);

	if (payment === undefined) {
		return null;
	}

	const paymentStatus = resolvePaymentStatus({ payment });
	const lightningPayment =
		payment.paymentLnSpark ?? payment.paymentLnNwc ?? payment.paymentLnZap;

	return (
		<div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_22rem]">
			<div className="flex min-w-0 flex-col gap-4">
				<ResponsiveCard>
					<CardHeader>
						<CardTitle>{payment.items[0]?.item.label}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={t("payments:detail.labels.price")}
									content={formatMoney({
										value: payment.totalAmount,
										currency: payment.currency,
									})}
									className={"flex-1"}
								/>
								<StaticCard
									title={t("payments:detail.labels.created-at")}
									content={new Date(payment.createdAt).toLocaleDateString()}
									footer={new Date(payment.createdAt).toLocaleTimeString()}
									className={"flex-1"}
								/>
							</div>
							<div className={"flex gap-4"}>
								<StaticCard
									title={t("payments:detail.labels.expire-at")}
									content={
										lightningPayment &&
										new Date(lightningPayment.expirationIn).toLocaleDateString()
									}
									footer={
										lightningPayment &&
										new Date(lightningPayment.expirationIn).toLocaleTimeString()
									}
									className={"flex-1"}
								/>

								<StaticCard
									title={t("payments:detail.labels.status")}
									content={t(`payments:detail.status.${paymentStatus}`)}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									{/*<KeyValueList*/}
									{/*	items={[*/}
									{/*		{*/}
									{/*			key: t("payments:detail.labels.merchant-name"),*/}
									{/*			value: item?.merchant?.name ?? "-",*/}
									{/*		},*/}
									{/*		{*/}
									{/*			key: t("payments:detail.labels.redirect"),*/}
									{/*			value:*/}
									{/*				item?.onSuccessfulPayment?.redirectUrl ??*/}
									{/*				t("payments:detail.values.no"),*/}
									{/*			help: t("payments:detail.help.redirect"),*/}
									{/*		},*/}
									{/*		{*/}
									{/*			key: t("payments:detail.labels.tip"),*/}
									{/*			value:*/}
									{/*				item?.onSuccessfulPayment && item.bill.allowTip*/}
									{/*					? t("payments:detail.values.yes")*/}
									{/*					: t("payments:detail.values.no"),*/}
									{/*			help: t("payments:detail.help.tip"),*/}
									{/*		},*/}
									{/*		...(item?.expectedTipAmount !== null*/}
									{/*			? [*/}
									{/*					{*/}
									{/*						key: t(*/}
									{/*							"payments:form.payment-form.label.expected-tip-amount",*/}
									{/*						),*/}
									{/*						value: formatMoney({*/}
									{/*							value: item.expectedTipAmount,*/}
									{/*							currency: item.bill.currency,*/}
									{/*						}),*/}
									{/*					},*/}
									{/*				]*/}
									{/*			: []),*/}
									{/*	]}*/}
									{/*/>*/}
								</div>
								<div className={"flex-1"}></div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>

				<ResponsiveCard>
					<CardHeader>
						<CardTitle>{t("payments:detail.sections.items")}</CardTitle>
					</CardHeader>
					<CardContent className="px-0">
						{payment.items.length === 0 ? (
							<div className="px-6 py-4 text-sm text-muted-foreground">
								{t("payments:detail.empty.items")}
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="px-6">
											{t("payments:detail.items.columns.item")}
										</TableHead>
										<TableHead>
											{t("payments:detail.items.columns.quantity")}
										</TableHead>
										<TableHead className="px-6 text-right">
											{t("payments:detail.items.columns.total")}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{payment.items.map((item) => (
										<TableRow key={item.id}>
											<TableCell className="px-6 whitespace-normal">
												{item.item.catalogItemId ? (
													<Link
														href={
															`/admin/catalog/detail?id=${encodeURIComponent(item.item.catalogItemId)}` as never
														}
														className="text-primary hover:underline"
													>
														{item.item.label}
													</Link>
												) : (
													item.item.label
												)}
											</TableCell>
											<TableCell>{item.quantity.toLocaleString()}</TableCell>
											<TableCell className="px-6 text-right">
												{formatMoney({
													value: item.totalAmount,
													currency: payment.currency,
												})}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</ResponsiveCard>
			</div>

			<div className="min-w-72 flex flex-col gap-10">
				<ResponsiveCard>
					<CardHeader>
						<CardTitle>{t("common:table.actions")}</CardTitle>
					</CardHeader>
					<CardContent className={"space-y-2"}>
						<FullscreenQrPayment
							frontendUrl={frontendUrl}
							lnInvoice={lightningPayment?.lnInvoice}
							czechQRCode={czechQRCode}
							isPaid={paymentStatus === PaymentStatus.Paid}
							cashTabContent={
								payment.paymentCash ? (
									<StatusButton
										paymentId={payment.id}
										amount={payment.totalAmount}
										currency={payment.currency}
										cashAccountId={payment.paymentCash.accountId}
										className={"w-full"}
									/>
								) : undefined
							}
						/>
						{!payment.paymentCash && (
							<p className={"text-sm text-muted-foreground"}>
								{t(
									"payments:detail.messages.cash-payment-enabled-no-cash-register-account",
								)}
							</p>
						)}
						<PaymentWatchingToggleButton
							paymentId={paymentId}
							hasPaymentWatchingState={payment.paymentWatchingState !== null}
							verifiedAt={payment.paymentWatchingState?.verifiedAt ?? null}
							stoppedAt={payment.paymentWatchingState?.stoppedAt ?? null}
							className={"w-full"}
						/>
						<DownloadPaymentReceiptButton
							paymentId={payment.id}
							paymentStatus={paymentStatus}
						/>
					</CardContent>
				</ResponsiveCard>

				{paymentStatus === PaymentStatus.Paid ? (
					<LoadingIndicator
						text={t("payments:detail.messages.payment-successfully-paid")}
						open={true}
						status={"success"}
						className={"mt-10"}
					/>
				) : (
					<Tabs value={tab ?? "web"} className="flex flex-col">
						<TabsList>
							{frontendUrl && (
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
									{t("payments:detail.tabs.web-payment")}
								</TabsTrigger>
							)}
							{lightningPayment && (
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
									{t("payments:detail.tabs.btc-ln-payment")}
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
									{t("payments:detail.tabs.cz-qr-payment")}
								</TabsTrigger>
							)}
							{payment.paymentCash && (
								<TabsTrigger
									value="cash"
									onClick={() =>
										router.replace(
											`/admin/payments/detail?id=${encodeURIComponent(id)}&tab=cash`,
											{
												scroll: false,
											},
										)
									}
								>
									{t("payments:detail.tabs.cash")}
								</TabsTrigger>
							)}
						</TabsList>
						{frontendUrl && (
							<TabsContent value="web">
								<ResponsiveCard>
									<CardContent>
										<div className={"flex flex-col gap-2"}>
											<div className={"py-4 bg-white flex rounded"}>
												<QRCodeSVG
													className={"w-full"}
													size={256}
													value={frontendUrl}
												/>
											</div>
											<Textarea readOnly={true} value={frontendUrl} />
											<Button
												render={
													<a
														href={frontendUrl}
														target={"_blank"}
														rel="noopener"
													>
														<ExternalLink />
														{t("payments:detail.actions.open")}
													</a>
												}
											></Button>
										</div>
									</CardContent>
								</ResponsiveCard>
							</TabsContent>
						)}
						{lightningPayment && (
							<TabsContent value="ln">
								<ResponsiveCard>
									<CardContent>
										<div className={"flex flex-col gap-2"}>
											<div className={"py-4 bg-white flex rounded"}>
												<QRCodeSVG
													className={"w-full"}
													size={256}
													value={lightningPayment.lnInvoice}
												/>
											</div>
											<Textarea
												readOnly={true}
												className={"wrap-anywhere"}
												value={lightningPayment.lnInvoice}
											/>
											<Button
												render={
													<a
														href={`lightning:${lightningPayment.lnInvoice}`}
														target={"_blank"}
														rel="noopener"
													>
														<BitcoinIcon />
														{t("payments:detail.actions.open-in-btc-wallet")}
													</a>
												}
											></Button>
										</div>
									</CardContent>
								</ResponsiveCard>
							</TabsContent>
						)}
						{czechQRCode && (
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
																title: t(
																	"payments:detail.actions.share-qr-code",
																),
																text: t(
																	"payments:detail.messages.share-qr-description",
																),
															});
														},
														mimetype,
														0.8,
													);
												}}
											>
												<DownloadIcon />
												{t("payments:detail.actions.download-qr-code")}
											</Button>
										</div>
									</CardContent>
								</ResponsiveCard>
							</TabsContent>
						)}
						{payment.paymentCash && (
							<TabsContent value="cash">
								<ResponsiveCard>
									<CardContent>
										<div className={"flex flex-col gap-3"}>
											<StatusButton
												paymentId={payment.id}
												amount={payment.totalAmount}
												currency={payment.currency}
												cashAccountId={payment.paymentCash.accountId}
												className={"w-full"}
											/>
											{/*{cashAccountId === null && (*/}
											{/*	<p className={"text-sm text-muted-foreground"}>*/}
											{/*		{t(*/}
											{/*			"payments:detail.messages.no-cash-register-account-configured",*/}
											{/*		)}*/}
											{/*	</p>*/}
											{/*)}*/}
										</div>
									</CardContent>
								</ResponsiveCard>
							</TabsContent>
						)}
					</Tabs>
				)}
			</div>
		</div>
	);
}
