"use client";

import { IconRefresh } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	ArrowLeftIcon,
	LoaderCircleIcon,
	QrCodeIcon,
	RecycleIcon,
	SquircleDashedIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useEffectEvent, useRef, useState } from "react";
import { BillItemList } from "@/app/(client)/bill-item-list";
import {
	createLoadingAtom,
	createPaymentFinishedAtom,
	createPaymentReadyAtom,
	createSelectedItemsAtom,
	createSelectedTipAtom,
	type LoadingAtom,
	type PaymentFinishedAtom,
	type PaymentReadyAtom,
	type SelectedItemsAtom,
	type SelectedTipAtom,
} from "@/app/(client)/bill-utils";
import { Header } from "@/components/header";
import { LoadingIndicator } from "@/components/loading-indicator";
import { TipSelector } from "@/components/tip-selector";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	Carousel,
	type CarouselApi,
	CarouselContent,
	CarouselItem,
} from "@/components/ui/carousel";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SelectButton } from "@/components/ui/select-button";
import { useNostr } from "@/hooks/use-nostr";
import { useOnMountUnsafe } from "@/hooks/use-on-mount-unsafe";
import type {
	BillDriverSubscriptionEvent,
	BillPaymentOption,
	BillScreenData,
	BillSubscription,
} from "@/lib/bill/billDriver";
import { billManager } from "@/lib/bill/billManager";
import { formatAmount } from "@/lib/format-utils";
import { assertNever } from "@/lib/type-utils";
import { Uuid7 } from "@/lib/types";
import {
	type PaymentInit,
	paymentFinishedStorage,
	paymentInitStorage,
	paymentReadyStorage,
} from "@/storages/payment-progress-storage";

const PayButton: React.FC<{
	subscription: BillSubscription | null;
	bill: BillScreenData;
	selectedItemsAtom: SelectedItemsAtom;
	selectedTipAtom: SelectedTipAtom;
	paymentReadyAtom: PaymentReadyAtom;
	paymentFinishedAtom: PaymentFinishedAtom;
	loadingAtom: LoadingAtom;
}> = (props) => {
	const { ndk } = useNostr();
	const [paymentReady, setPaymentReady] = useAtom(props.paymentReadyAtom);
	const setPaymentFinished = useSetAtom(props.paymentFinishedAtom);
	const setLoading = useSetAtom(props.loadingAtom);
	const [paymentMethod, setPaymentMethod] =
		useState<BillPaymentOption>("btcLn");
	const selectedItems = useAtomValue(props.selectedItemsAtom);
	const selectedTip = useAtomValue(props.selectedTipAtom);

	const itemsAmount =
		props.bill.bill !== null
			? props.bill.bill.items.reduce((acc, item) => {
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
					setPaymentReady(null);

					try {
						await (async () => {
							if (props.subscription !== null && props.bill.bill) {
								const items: { id: string; price: number; quantity: number }[] =
									[];

								for (const item of props.bill.bill.items ?? []) {
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
									currency: props.bill.bill.currency,
									merchant: props.bill.merchant,
									paymentOption: {
										type: paymentMethod,
									},
								};

								await paymentInitStorage.insertOrUpdate(
									ndk,
									paymentId,
									paymentInit,
								);

								setLoading("The payment is preparing");
								const paymentFinished =
									await props.subscription.pay(paymentInit);
								setPaymentFinished(paymentFinished);
								setPaymentReady(undefined);
								setLoading(null);
								if (paymentFinished.paymentId) {
									await paymentFinishedStorage.insertOrUpdate(
										ndk,
										paymentFinished.paymentId,
										paymentFinished,
									);
								}
								return;
							}
						})();
					} catch (e) {
						setPaymentReady(undefined);
						throw e;
					}
				}}
			>
				{paymentReady === undefined && (
					<>
						{totalAmount >= 0 ? "Pay" : "Refund"}
						<motion.span
							key={`${totalAmount} ${props.bill.bill?.currency}`}
							initial={{ scale: 1.1, opacity: 0.5 }}
							animate={{ scale: 1, opacity: 1 }}
						>
							{formatAmount(Math.abs(totalAmount), props.bill.bill?.currency)}
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
	bill: BillScreenData | null;
	selectedItemsAtom: SelectedItemsAtom;
	selectedTipAtom: SelectedTipAtom;
	paymentReadyAtom: PaymentReadyAtom;
	paymentFinishedAtom: PaymentFinishedAtom;
	loadingAtom: LoadingAtom;
}> = ({
	subscription,
	bill,
	selectedItemsAtom,
	selectedTipAtom,
	paymentReadyAtom,
	paymentFinishedAtom,
	loadingAtom,
}) => {
	const [isOpen, setOpen] = useState(false);
	const [paymentReady, setPaymentReady] = useAtom(paymentReadyAtom);
	const [paymentFinished, setPaymentFinished] = useAtom(paymentFinishedAtom);

	useEffect(() => {
		if (
			!isOpen &&
			bill !== null &&
			bill.bill !== null &&
			paymentFinished === null
		) {
			setOpen(true);
		} else if (
			isOpen &&
			(bill === null || bill.bill === null || paymentFinished !== null)
		) {
			setOpen(false);
		}
	}, [bill, isOpen, paymentFinished]);

	const totalAmount =
		(paymentReady?.bill.items.reduce((acc, item) => {
			return item.price * item.quantity + acc;
		}, 0) ?? 0) + (paymentReady?.bill.tip ?? 0);

	return (
		<div
			className={
				"bg-card rounded-t-2xl p-4 w-full max-w-xl flex flex-col gap-2 shadow-2xl fixed bottom-0"
			}
		>
			<Collapsible open={isOpen}>
				<CollapsibleContent>
					<div className={"flex flex-col gap-4 shadow-2xl"}>
						{paymentReady ? (
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
											href={`lightning:${paymentReady && paymentReady.type === "btcLn" ? paymentReady.lnInvoice : ""}`}
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
								<Button
									className={"h-12 w-full"}
									variant={"outline"}
									size={"lg"}
									onClick={async () => {
										setPaymentReady(undefined);
										setPaymentFinished(null);
									}}
								>
									<ArrowLeftIcon /> Back to the bill
								</Button>
							</div>
						) : (
							bill !== null &&
							bill.bill !== null && (
								<>
									{bill.bill.allowTip === true && (
										<div
											className={
												"text-xs text-muted-foreground font-bold flex flex-col gap-2"
											}
										>
											<span className={"uppercase"}>Tip for the staff</span>
											<TipSelector selectedTipAtom={selectedTipAtom} />
										</div>
									)}
									<div className={"flex gap-2"}>
										<ButtonGroup className={"w-full"}>
											<PayButton
												subscription={subscription}
												bill={bill}
												selectedItemsAtom={selectedItemsAtom}
												selectedTipAtom={selectedTipAtom}
												paymentReadyAtom={paymentReadyAtom}
												paymentFinishedAtom={paymentFinishedAtom}
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
	bill: BillScreenData | null;
	selectedItemsAtom: SelectedItemsAtom;
	paymentReadyAtom: PaymentReadyAtom;
	paymentFinishedAtom: PaymentFinishedAtom;
	onBackToTheBill: () => void;
}> = (props) => {
	const apiRef = useRef<CarouselApi | null>(null);
	const paymentReadyFromAtom = useAtomValue(props.paymentReadyAtom);
	const [paymentFinished, setPaymentFinished] = useAtom(
		props.paymentFinishedAtom,
	);
	const [paymentReady, setPaymentReady] = useState(paymentReadyFromAtom);

	useEffect(() => {
		if (!apiRef.current) {
			return;
		}

		const currentScroll = apiRef.current.scrollProgress();

		if (
			paymentReadyFromAtom === undefined &&
			paymentFinished === null &&
			currentScroll !== 0
		) {
			apiRef.current.scrollTo(0);
			return;
		}

		if (
			(paymentFinished !== null || paymentReadyFromAtom !== undefined) &&
			currentScroll !== 1
		) {
			setPaymentReady(paymentReadyFromAtom);
			apiRef.current.scrollTo(1);
			return;
		}
	}, [paymentReadyFromAtom, paymentFinished]);

	const totalAmount =
		paymentReady?.bill.items.reduce(
			(acc, value) => acc + value.price * value.quantity,
			0,
		) ?? 0;

	return (
		<>
			{props.bill !== null && props.bill.bill !== null && (
				<div className={"mb-28 flex flex-col grow"}>
					{props.bill.variant === "refund" && (
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

					{(props.bill.variant === undefined ||
						props.bill.variant === "payment") &&
						props.bill.bill.items.length === 0 && (
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

					<Carousel
						className="w-full"
						setApi={(api) => {
							apiRef.current = api;
						}}
					>
						<CarouselContent>
							<CarouselItem>
								{props.bill?.table?.name && (
									<h3
										className={
											"text-md font-bold text-foreground m-auto py-4 px-4"
										}
									>
										{props.bill.table.name}
									</h3>
								)}
								<BillItemList
									bill={props.bill.bill}
									selectedItemsAtom={props.selectedItemsAtom}
								/>
							</CarouselItem>
							<CarouselItem>
								{paymentFinished !== null && (
									<div
										className={
											"w-full flex h-dvh flex-col items-center justify-evenly"
										}
									>
										<LoadingIndicator
											text={
												paymentFinished.type === "failure"
													? paymentFinished.reason
													: "The payment is successfully paid"
											}
											open={true}
											status={paymentFinished.type}
										/>
										<Button
											type={"button"}
											size={"lg"}
											onClick={() => {
												props.onBackToTheBill();
												setPaymentReady(undefined);
												setPaymentFinished(null);
											}}
										>
											<ArrowLeftIcon /> Back to the bill
										</Button>
									</div>
								)}

								{paymentFinished === null && paymentReady && (
									<div
										className={
											"w-full flex h-dvh pb-80 flex-col items-center gap-12 justify-evenly"
										}
									>
										<div className={"flex flex-col items-center gap-4"}>
											<div className={"text-2xl"}>
												<strong>
													{formatAmount(
														paymentReady.amountExpectedToPay
															? paymentReady.amountExpectedToPay.value
															: totalAmount,
														paymentReady.amountExpectedToPay
															? paymentReady.amountExpectedToPay.currency
															: paymentReady.bill.currency,
													)}
												</strong>
											</div>
											{paymentReady.amountExpectedToPay && (
												<div className={"text-2xl"}>
													{formatAmount(
														totalAmount,
														paymentReady.bill.currency,
													)}
												</div>
											)}
										</div>

										{paymentReady.amountExpectedToPay && (
											<div className={"text-xs text-muted-foreground"}>
												rate{" "}
												{formatAmount(paymentReady.amountExpectedToPay.rate)}{" "}
												{paymentReady.amountExpectedToPay.currency}/
												{paymentReady.bill.currency}
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
							</CarouselItem>
						</CarouselContent>
					</Carousel>
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
	const [sessionId, setSessionId] = useState<Uuid7 | null>(null);
	const store = useStore();
	const router = useRouter();
	const [selectedItemsAtom] = useState(createSelectedItemsAtom);
	const [selectedTipAtom] = useState(createSelectedTipAtom);
	const [paymentReadyAtom] = useState(createPaymentReadyAtom);
	const [paymentFinishedAtom] = useState(createPaymentFinishedAtom);
	const [loadingAtom] = useState(() =>
		createLoadingAtom("Loading the data..."),
	);
	const { ndk } = useNostr();
	const [subscription, setSubscription] = useState<BillSubscription | null>(
		null,
	);
	const [bill, setBill] = useState<BillScreenData | null>(null);
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

			if (event.type === "bill") {
				setBill(event.payload);
				store.set(loadingAtom, null);
				return;
			}

			if (event.type === "paymentInProgress") {
				store.set(loadingAtom, event.payload.text);
				return;
			}

			if (event.type === "paymentReady") {
				await paymentReadyStorage.insertOrUpdate(
					ndk,
					event.payload.paymentId,
					event.payload,
				);
				store.set(paymentReadyAtom, event.payload);
				store.set(loadingAtom, null);
				return;
			}

			if (event.type === "closed") {
				alert("The bill is closed");
				router.replace("/scan");
				return;
			}

			if (event.type === "resetBill") {
				store.set(paymentFinishedAtom, null);
				store.set(loadingAtom, "Loading the data...");
				store.set(paymentReadyAtom, undefined);
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
	}, [qrCode, ndk, sessionId]);

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
			<div className={"h-18"} />
			<Header
				title={bill !== null ? bill.merchant?.name : ""}
				endAddon={
					bill?.allowManualRefresh && (
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

			<Screen
				bill={bill}
				selectedItemsAtom={selectedItemsAtom}
				paymentReadyAtom={paymentReadyAtom}
				paymentFinishedAtom={paymentFinishedAtom}
				onBackToTheBill={async () => {
					store.set(paymentFinishedAtom, null);
					store.set(loadingAtom, "Loading the data...");
					store.set(paymentReadyAtom, undefined);
					setSessionId(Uuid7.random());
				}}
			/>

			<BottomPanel
				subscription={subscription}
				bill={bill}
				selectedItemsAtom={selectedItemsAtom}
				selectedTipAtom={selectedTipAtom}
				paymentReadyAtom={paymentReadyAtom}
				paymentFinishedAtom={paymentFinishedAtom}
				loadingAtom={loadingAtom}
			/>
		</div>
	);
}
