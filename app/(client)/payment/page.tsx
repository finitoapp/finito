"use client";


import { useTranslation } from "react-i18next";
import { createIdFromString, getOrThrow } from "@evolu/common";
import { IconRefresh } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import {
	ArrowLeftIcon,
	LoaderCircleIcon,
	QrCodeIcon,
	RecycleIcon,
	SquircleDashedIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useEffectEvent, useState } from "react";
import { BillItemList } from "@/app/(client)/bill-item-list";
import {
	createLoadingAtom,
	createSelectedItemsAtom,
	createSelectedTipAtom,
	type LoadingAtom,
	type SelectedItemsAtom,
	type SelectedTipAtom,
} from "@/app/(client)/bill-utils";
import { FadeHeader } from "@/components/fade-header";
import { LoadingIndicator } from "@/components/loading-indicator";
import { TipSelector } from "@/components/tip-selector";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SelectButton } from "@/components/ui/select-button";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";
import { useOnMountUnsafe } from "@/hooks/use-on-mount-unsafe";
import type {
	BillDriverSubscriptionEvent,
	BillPaymentOption,
	BillSubscription,
	ScreenData,
} from "@/lib/bill/billDriver";
import { billManager } from "@/lib/bill/billManager";
import { formatAmount } from "@/lib/format-utils";
import { assertNever } from "@/lib/type-utils";
import { Uuid7 } from "@/lib/types";
import type { PaymentInit } from "@/storages/payment-progress-storage";

const PayButton: FC<{
	subscription: BillSubscription | null;
	screen: ScreenData;
	selectedItemsAtom: SelectedItemsAtom;
	selectedTipAtom: SelectedTipAtom;
	loadingAtom: LoadingAtom;
}> = (props) => {
	const evolu = useEvolu();
	const setLoading = useSetAtom(props.loadingAtom);
	const [paymentMethod, setPaymentMethod] =
		useState<BillPaymentOption>("btcLn");
	const selectedItems = useAtomValue(props.selectedItemsAtom);
	const selectedTip = useAtomValue(props.selectedTipAtom);

	const itemsAmount =
		props.screen.variant === "payment" && props.screen.payload.bill !== null
			? props.screen.payload.bill.items.reduce((acc, item) => {
					const quantity =
						item.optionality === undefined
							? item.quantity
							: Math.min(
									selectedItems[item.id] ?? item.optionality.checked,
									item.quantity,
								);

					return item.price * quantity + acc;
				}, 0)
			: 0;
	const totalAmount = itemsAmount * (1 + selectedTip / 100);

	return (
		<>
			<SelectButton
				value={paymentMethod}
				onValueChange={setPaymentMethod}
				options={[
					{
						value: "btcLn",
						label: "BTC lightning",
					},
					{
						value: "bankTransferCZ",
						label: "Bank transfer",
					},
				]}
				size={"lg"}
				className={"h-12 flex-1"}
			/>
			<Button
				className={"h-12 w-60"}
				size={"lg"}
				disabled={totalAmount === 0}
				onClick={async () => {
					await (async () => {
						if (
							props.subscription !== null &&
							(props.screen.variant === "payment" ||
								props.screen.variant === "refund") &&
							props.screen.payload.bill
						) {
							const pay = props.screen.pay;

							const items: { id: string; price: number; quantity: number }[] =
								[];

							for (const item of props.screen.variant === "payment"
								? props.screen.payload.bill.items
								: []) {
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
									price: item.price,
									quantity: quantity,
								});
							}

							if (items.length === 0) {
								return;
							}

							const paymentId = Uuid7.random();
							const paymentInit: PaymentInit = {
								paymentId,
								items,
								tip: itemsAmount * (selectedTip / 100),
								currency: props.screen.payload.bill.currency,
								merchant: props.screen.payload.merchant,
								paymentOption: {
									type: paymentMethod,
								},
							};

							setLoading("The payment is preparing");
							getOrThrow(
								evolu.upsert("paymentInit", {
									id: createIdFromString(paymentId),
									tip: paymentInit.tip,
									currency: paymentInit.currency,
									paymentOptionType: paymentInit.paymentOption.type,
									merchantName: paymentInit.merchant?.name ?? null,
									merchantPhone: paymentInit.merchant?.phone ?? null,
								}),
							);
							for (const [index, item] of paymentInit.items.entries()) {
								getOrThrow(
									evolu.upsert("paymentInitItem", {
										id: createIdFromString(
											`${paymentId}:paymentInitItem:${index}`,
										),
										paymentInitId: createIdFromString(paymentId),
										itemId: item.id,
										price: item.price,
										quantity: item.quantity,
									}),
								);
							}
							await pay(paymentInit);
							setLoading(null);
							return;
						}
					})();
				}}
			>
				{(props.screen.variant === "payment" ||
					props.screen.variant === "refund") && (
					<>
						{totalAmount >= 0 ? "Pay" : "Refund"}
						<motion.span
							key={`${totalAmount} ${props.screen.payload.bill?.currency}`}
							initial={{ scale: 1.1, opacity: 0.5 }}
							animate={{ scale: 1, opacity: 1 }}
						>
							{formatAmount(
								Math.abs(totalAmount),
								props.screen.payload.bill?.currency,
							)}
						</motion.span>
						{/*<ChevronsRightIcon strokeWidth={2} />*/}
					</>
				)}
			</Button>
		</>
	);
};

const BottomPanel: FC<{
	subscription: BillSubscription | null;
	screen: ScreenData | null;
	selectedItemsAtom: SelectedItemsAtom;
	selectedTipAtom: SelectedTipAtom;
	loadingAtom: LoadingAtom;
}> = ({
	subscription,
	screen,
	selectedItemsAtom,
	selectedTipAtom,
	loadingAtom,
}) => {
	const [isOpen, setOpen] = useState(false);

	useEffect(() => {
		if (
			!isOpen &&
			(screen?.variant === "payment" ||
				screen?.variant === "paymentReady" ||
				screen?.variant === "refund")
		) {
			setOpen(true);
		} else if (isOpen && screen?.variant === "paymentFinished") {
			setOpen(false);
		}
	}, [isOpen, screen?.variant]);

	const totalAmount =
		(screen?.variant === "paymentReady" &&
			(screen.payload.bill.items.reduce((acc, item) => {
				return item.price * item.quantity + acc;
			}, 0) ?? 0) + (screen.payload.bill.tip ?? 0)) ||
		0;

	return (
		<div
			className={
				"bg-card rounded-t-2xl w-full max-w-xl shadow-2xl fixed bottom-0"
			}
			style={{
				paddingBottom: "env(safe-area-inset-bottom)",
			}}
		>
			<Collapsible open={isOpen}>
				<CollapsibleContent>
					<div className={"flex flex-col gap-4 shadow-2xl p-4"}>
						{screen && screen.variant === "paymentReady" ? (
							<div className={"flex flex-col gap-4"}>
								<ButtonGroup className={"w-full"}>
									<SelectButton
										value={"external"}
										onValueChange={() => {}}
										options={[
											{
												value: "external",
												label: "External Wallet",
											},
											{
												value: "primalWallet",
												label: "Primal Wallet",
											},
											{
												value: "bitlifi",
												label: "Bitlifi",
											},
										]}
										size={"lg"}
										className={"h-12 flex-1"}
									/>
									<Button
										className={"h-12 w-30"}
										size={"lg"}
										onClick={async () => {}}
										asChild
									>
										<a
											href={`lightning:${screen.payload.type === "btcLn" ? screen.payload.lnInvoice : ""}`}
										>
											{totalAmount >= 0 ? "Pay" : "Refund"}
										</a>
									</Button>
								</ButtonGroup>
								<Button
									className={"h-12 w-full"}
									variant={"outline"}
									size={"lg"}
									onClick={async () => {}}
								>
									<QrCodeIcon /> Copy & display QR invoice
								</Button>
							</div>
						) : (
							screen !== null &&
							screen.variant === "payment" &&
							screen.payload.bill !== null && (
								<>
									{screen.payload.bill.allowTip === true && (
										<div
											className={
												"text-xs text-muted-foreground font-bold flex flex-col gap-2"
											}
										>
											<span className={"uppercase"}>{t("client:bill.tipForStaff")}</span>
											<TipSelector selectedTipAtom={selectedTipAtom} />
										</div>
									)}
									<div className={"flex gap-2"}>
										<ButtonGroup className={"w-full"}>
											<PayButton
												subscription={subscription}
												screen={screen}
												selectedItemsAtom={selectedItemsAtom}
												selectedTipAtom={selectedTipAtom}
												loadingAtom={loadingAtom}
											/>
										</ButtonGroup>
									</div>
								</>
							)
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
};

const Screen: FC<{
	screen: ScreenData | null;
	selectedItemsAtom: SelectedItemsAtom;
}> = (props) => {
	const totalAmount =
		props.screen && props.screen.variant === "paymentReady"
			? props.screen.payload.bill.items.reduce(
					(acc, value) => acc + value.price * value.quantity,
					0,
				)
			: 0;

	return (
		<>
			{props.screen !== null && (
				<div className={"mb-28 flex flex-col grow"}>
					{props.screen.variant === "refund" && (
						<div
							className={
								"fixed w-xl h-full max-w-full flex justify-center items-center pb-60"
							}
						>
							<RecycleIcon
								size={300}
								className={"text-muted-foreground opacity-5"}
							/>
						</div>
					)}

					{(props.screen?.variant === "payment" ||
						props.screen?.variant === "refund") &&
						props.screen.payload.bill &&
						props.screen.payload.bill.items.length === 0 && (
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
						)}

					{(props.screen.variant === "payment" ||
						props.screen.variant === "refund") &&
						props.screen.payload.table?.name && (
							<h3
								className={"text-md font-bold text-foreground m-auto py-4 px-4"}
							>
								{props.screen.payload.table.name}
							</h3>
						)}
					{(props.screen.variant === "payment" ||
						props.screen.variant === "refund") &&
						props.screen.payload.bill && (
							<BillItemList
								bill={props.screen.payload.bill}
								selectedItemsAtom={props.selectedItemsAtom}
							/>
						)}
					{props.screen?.variant === "paymentFinished" && (
						<div
							className={
								"w-full flex h-full flex-col items-center justify-evenly"
							}
						>
							<LoadingIndicator
								text={
									props.screen.payload.type === "failure"
										? props.screen.payload.reason
										: "The payment is successfully paid"
								}
								open={true}
								status={props.screen.payload.type}
							/>
						</div>
					)}

					{props.screen.variant === "paymentReady" && (
						<div
							className={
								"w-full flex h-full pb-80 flex-col items-center gap-12 justify-evenly"
							}
						>
							<div className={"flex flex-col items-center gap-4"}>
								<div className={"text-2xl"}>
									<strong>
										{formatAmount(
											props.screen.payload.amountExpectedToPay
												? props.screen.payload.amountExpectedToPay.value
												: totalAmount,
											props.screen.payload.amountExpectedToPay
												? props.screen.payload.amountExpectedToPay.currency
												: props.screen.payload.bill.currency,
										)}
									</strong>
								</div>
								{props.screen.payload.amountExpectedToPay && (
									<div className={"text-2xl"}>
										{formatAmount(
											totalAmount,
											props.screen.payload.bill.currency,
										)}
									</div>
								)}
							</div>

							{props.screen.payload.amountExpectedToPay && (
								<div className={"text-xs text-muted-foreground"}>
									rate{" "}
									{formatAmount(props.screen.payload.amountExpectedToPay.rate)}{" "}
									{props.screen.payload.amountExpectedToPay.currency}/
									{props.screen.payload.bill.currency}
								</div>
							)}

							<div className={"flex flex-col items-center gap-4"}>
								<LoaderCircleIcon className="animate-spin size-12 text-muted-foreground" />

								<div className={"text-xs text-muted-foreground"}>
									{totalAmount >= 0
										? "We are waiting for your payment"
										: "We are waiting for your refund"}
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</>
	);
};

const Loading: FC<{
	loadingAtom: LoadingAtom;
}> = (props) => {
	const loading = useAtomValue(props.loadingAtom);

	return (
		<LoadingIndicator
			text={loading ?? "The payment is successfully paid"}
			open={loading !== null}
			status={"loading"}
			variant={"fullscreen"}
		/>
	);
};

export default function Page() {
	const { t } = useTranslation();
	const [sessionId, setSessionId] = useState<Uuid7 | null>(null);
	const store = useStore();
	const router = useRouter();
	const [selectedItemsAtom] = useState(createSelectedItemsAtom);
	const [selectedTipAtom] = useState(createSelectedTipAtom);
	const [loadingAtom] = useState(() =>
		createLoadingAtom("Loading the data..."),
	);
	const { ndk } = useNostr();
	const evolu = useEvolu();
	const [subscription, setSubscription] = useState<BillSubscription | null>(
		null,
	);
	const [screen, setScreen] = useState<ScreenData | null>(null);
	const [qrCode, setQrCode] = useState<string | null>(null);

	const subscriptionHandler = useEffectEvent(
		async (
			event: BillDriverSubscriptionEvent,
			subscriptionPromise: Promise<BillSubscription | null>,
		) => {
			if (event.type === "billLoading") {
				store.set(loadingAtom, event.payload.text);
				return;
			}

			if (event.type === "screen") {
				if (event.payload.variant === "paymentReady") {
					const payload = event.payload.payload;
					getOrThrow(
						evolu.upsert("paymentReady", {
							id: createIdFromString(payload.paymentId),
							billTip: payload.bill.tip ?? null,
							billCurrency: payload.bill.currency,
							amountExpectedToPayValue:
								payload.amountExpectedToPay?.value ?? null,
							amountExpectedToPayRate:
								payload.amountExpectedToPay?.rate ?? null,
							amountExpectedToPayCurrency:
								payload.amountExpectedToPay?.currency ?? null,
						}),
					);
					for (const [index, item] of payload.bill.items.entries()) {
						getOrThrow(
							evolu.upsert("paymentReadyItem", {
								id: createIdFromString(
									`${payload.paymentId}:paymentReadyItem:${index}`,
								),
								paymentReadyId: createIdFromString(payload.paymentId),
								itemId: item.id,
								price: item.price,
								quantity: item.quantity,
								label: item.label,
							}),
						);
					}
				} else if (event.payload.variant === "paymentFinished") {
					const payload = event.payload.payload;
					const paymentId = payload.paymentId;
					if (!paymentId) return;
					getOrThrow(
						evolu.upsert("paymentFinished", {
							id: createIdFromString(paymentId),
							type: payload.type,
							reason: payload.type === "failure" ? payload.reason : null,
							refundType:
								payload.type === "failure"
									? (payload.refund?.type ?? null)
									: null,
							refundLnInvoice:
								payload.type === "failure"
									? payload.refund?.type === "btcLn"
										? payload.refund.lnInvoice
										: null
									: null,
						}),
					);
				}

				setScreen(event.payload);
				store.set(loadingAtom, null);
				return;
			}

			if (event.type === "paymentInProgress") {
				store.set(loadingAtom, event.payload.text);
				return;
			}

			if (event.type === "closed") {
				alert("The bill is closed");
				router.replace("/");
				return;
			}

			if (event.type === "resetBill") {
				store.set(loadingAtom, "Loading the data...");
				const subscription = await subscriptionPromise;
				if (subscription !== null) {
					void subscription.refresh();
				}
				return;
			}

			assertNever(event);
		},
	);

	useEffect(() => {
		let finished = false;
		let subscriptionPromise: Promise<null | BillSubscription> =
			Promise.resolve(null);

		if (qrCode === null || sessionId === null) {
			return;
		}

		(async () => {
			subscriptionPromise = billManager.subscribe({
				ndk,
				billId: qrCode,
				callback: async (event) => {
					await subscriptionHandler(event, subscriptionPromise);
				},
			});

			const subscription = await subscriptionPromise;
			if (finished) {
				return;
			}

			if (subscription === null) {
				alert("Unknown QR code");
				router.replace("/");
				return;
			}

			setSubscription(subscription);
		})();

		return () => {
			finished = true;

			if (subscriptionPromise !== null) {
				subscriptionPromise.then((subscription) => {
					if (subscription === null) {
						return;
					}

					return subscription.close();
				});
			}
		};
	}, [qrCode, ndk, sessionId, router]);

	useOnMountUnsafe(() => {
		(async () => {
			const hash = (() => {
				const [hash, ...rest] = decodeURIComponent(window.location.hash)
					.replace(/^#/, "")
					.split("#");

				if (rest.length === 0) {
					return hash;
				}

				return rest.join("#");
			})();

			setQrCode(hash);
			setSessionId(Uuid7.random());
		})();
	});

	return (
		<div className="w-full flex flex-col justify-between min-h-full">
			<div className={"h-24"} />
			<FadeHeader
				title={
					screen !== null && screen?.variant === "payment"
						? screen.payload.merchant?.name
						: ""
				}
				startAddon={
					<Button
						type={"button"}
						variant={"ghost"}
						onClick={() => {
							if (screen?.variant === "paymentReady" && screen.parentScreen) {
								setScreen(screen.parentScreen);
								return;
							}

							router.replace("/");
						}}
					>
						<ArrowLeftIcon className={"text-primary"} />
					</Button>
				}
				endAddon={
					screen?.variant === "payment" &&
					screen.payload.allowManualRefresh && (
						<Button
							type={"button"}
							variant={"secondary"}
							onClick={async () => {
								if (subscription !== null) {
									await subscription.refresh();
								}
							}}
						>
							<IconRefresh />
						</Button>
					)
				}
			/>

			<Loading loadingAtom={loadingAtom} />

			<Screen screen={screen} selectedItemsAtom={selectedItemsAtom} />

			<BottomPanel
				subscription={subscription}
				screen={screen}
				selectedItemsAtom={selectedItemsAtom}
				selectedTipAtom={selectedTipAtom}
				loadingAtom={loadingAtom}
			/>
		</div>
	);
}
