import NDK, {
	NDKPrivateKeySigner,
	type NDKSigner,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { useDebounce } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import { useSetAtom } from "jotai";
import {
	FullscreenIcon,
	Loader2,
	MinusIcon,
	PlusIcon,
	QrCodeIcon,
	Trash2Icon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
	type FC,
	Fragment,
	useEffect,
	useRef,
	useState,
	useTransition,
} from "react";
import { z } from "zod";
import { type Pos, posAtom } from "@/atoms/pos";
import { ComboboxDefault } from "@/components/combobox/default";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAsyncRoutePush } from "@/hooks/use-async-route-push";
import { createEmptyBill, useBill } from "@/hooks/use-bill";
import { useNostr } from "@/hooks/use-nostr";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { currencyConverter } from "@/lib/currency-converter/currency-converter";
import { formatAmount } from "@/lib/format-utils";
import { createPayment, createZapPayment } from "@/lib/payment-utils";
import type { StaticOfflinePayment } from "@/lib/schemas";
import { Currency, type NonEmptyString, Uuid7 } from "@/lib/types";
import { clientBaseUrl } from "@/lib/window-utils";
import { accountStorage } from "@/storages/account-storage";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";
import { tableStorage } from "@/storages/table-storage";

const Item: React.FC<{
	item: Pos["bills"][string]["items"][number];
	itemIndex: number;
	billId: string;
	onRemove: () => unknown;
}> = (props) => {
	const [isRemoving, setIsRemoving] = useState(false);
	const setPos = useSetAtom(posAtom);

	return (
		<AnimatePresence>
			{!isRemoving && (
				<motion.div
					className="flex items-center justify-between p-2 bg-muted rounded-lg"
					initial={{ scale: 0, opacity: 0 }}
					exit={{ scale: 0, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{
						duration: 0.2,
						type: "spring",
					}}
				>
					<div className="flex-1">
						<h4 className="font-medium text-sm">{props.item.name}</h4>
						<p className="text-xs text-muted-foreground">
							{formatAmount(props.item.price, props.item.currency)} each
						</p>
					</div>
					<div className="flex items-center gap-2">
						<ButtonGroup>
							<Button
								disabled={props.item.quantity <= 1}
								size="sm"
								variant="outline"
								onClick={() =>
									setPos((prev) => ({
										...prev,
										bills: {
											...prev.bills,
											[props.billId]: {
												...prev.bills[props.billId],
												items: [
													...prev.bills[props.billId].items.slice(
														0,
														props.itemIndex,
													),
													{
														...prev.bills[props.billId].items[props.itemIndex],
														quantity: Math.max(
															prev.bills[props.billId].items[props.itemIndex]
																.quantity - 1,
															1,
														),
													},
													...prev.bills[props.billId].items.slice(
														props.itemIndex + 1,
													),
												],
											},
										},
									}))
								}
								className="h-8 w-8 p-0"
							>
								<MinusIcon className="h-3 w-3" />
							</Button>
							<Button
								size="sm"
								type={"button"}
								disabled={true}
								variant="outline"
								className={"w-10"}
								asChild={true}
							>
								<motion.div
									key={props.item.quantity}
									initial={{ scale: 1.5, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									// className="flex justify-center text-sm font-medium"
								>
									{props.item.quantity}
								</motion.div>
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									setPos((prev) => ({
										...prev,
										bills: {
											...prev.bills,
											[props.billId]: {
												...prev.bills[props.billId],
												items: [
													...prev.bills[props.billId].items.slice(
														0,
														props.itemIndex,
													),
													{
														...prev.bills[props.billId].items[props.itemIndex],
														quantity:
															prev.bills[props.billId].items[props.itemIndex]
																.quantity + 1,
													},
													...prev.bills[props.billId].items.slice(
														props.itemIndex + 1,
													),
												],
											},
										},
									}))
								}
								className="h-8 w-8 p-0"
							>
								<PlusIcon className="h-3 w-3" />
							</Button>
						</ButtonGroup>
						<Button
							size="sm"
							variant="destructive"
							onClick={() => {
								setIsRemoving(true);
								setTimeout(props.onRemove, 200);
							}}
							className="h-8 w-8 p-0 ml-2"
						>
							<Trash2Icon className="h-3 w-3" />
						</Button>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

const PosBillName: React.FC<{
	billId?: string;
	billLabel: string;
	placeholder: string;
	defaultCurrency: Currency;
}> = (props) => {
	const firstRender = useRef<string>(props.billLabel);
	const [value, setValue] = useState(props.billLabel);
	const setPos = useSetAtom(posAtom);
	const debouncedValue = useDebounce(value, 300);

	useEffect(() => {
		if (firstRender.current === debouncedValue) {
			return;
		}

		firstRender.current = debouncedValue;

		console.log("save");
		setPos((prev) => {
			if (props.billId === undefined) {
				return prev;
			}

			return {
				...prev,
				bills: {
					...prev.bills,
					[props.billId]: {
						...(prev.bills[props.billId] ??
							createEmptyBill({ defaultCurrency: props.defaultCurrency })),
						label: debouncedValue,
					},
				},
			};
		});
	}, [debouncedValue, setPos, props.billId, props.defaultCurrency]);

	return (
		<Input
			value={value}
			onChange={(e) => setValue(e.target.value)}
			placeholder={props.placeholder}
		/>
	);
};

const TableQrCode: React.FC<{
	tableQrCode?: string;
}> = (props) => {
	const { ndk } = useNostr();
	const frontendUrl =
		props.tableQrCode &&
		`${clientBaseUrl}#t-${ndk.signer.pubkey}-${props.tableQrCode}`;

	return (
		<>
			<Dialog>
				<DialogTrigger asChild>
					<Button
						size={"icon"}
						variant={"outline"}
						disabled={props.tableQrCode === undefined}
						title={
							props.tableQrCode === undefined
								? "Table is not selected"
								: undefined
						}
					>
						<QrCodeIcon />
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Table QR Code</DialogTitle>
					</DialogHeader>

					<div className={"py-4 bg-white flex rounded"}>
						<QRCodeSVG
							className={"w-full"}
							size={256}
							value={frontendUrl ?? ""}
						/>
					</div>
				</DialogContent>
			</Dialog>
			<Button
				size={"icon"}
				variant={"outline"}
				disabled={props.tableQrCode === undefined}
				asChild={true}
			>
				<a href={frontendUrl} target={"_blank"}>
					<FullscreenIcon />
				</a>
			</Button>
		</>
	);
};

const PosBillTable: React.FC<{
	billId?: string;
	billLabel: string;
	placeholder: string;
	defaultCurrency: Currency;
	table?: {
		id: string;
		name: NonEmptyString;
		qrCode?: NonEmptyString;
	};
}> = (props) => {
	const setPos = useSetAtom(posAtom);

	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(tableStorage, {
		limit: 5,
	});

	const table =
		items && props.table
			? items.find((item) => item.value.id === props.table?.id)
			: undefined;
	const tableQrCode = table && table.value.qrCodes && table.value.qrCodes[0];

	return (
		<div className={"flex gap-2"}>
			<ComboboxDefault
				items={(items ?? []).map((item) => ({
					value: {
						id: item.value.id,
						name: item.value.label,
					},
					label: item.value.label,
				}))}
				placeholder={"Select a table"}
				value={props.table ?? null}
				compareFunction={(a, b) => a?.id === b?.id}
				formatCustomValue={(value) => value.name}
				onChange={(value) => {
					setPos((prev) => {
						if (props.billId === undefined) {
							return prev;
						}

						return {
							...prev,
							bills: {
								...prev.bills,
								[props.billId]: {
									...(prev.bills[props.billId] ??
										createEmptyBill({
											defaultCurrency: props.defaultCurrency,
										})),
									table: value ?? undefined,
								},
							},
						};
					});
				}}
			/>
			<TableQrCode tableQrCode={tableQrCode ? tableQrCode.id : undefined} />
		</div>
	);
};

const PayButton: FC<{
	bill: Pos["bills"][string];
	billId: string;
	total: number;
}> = (props) => {
	const { ndk } = useNostr();
	const storageDeps = useStorageDeps();
	const [isSaving, startTransition] = useTransition();
	const { deleteBill } = useBill();
	const asyncRoutePush = useAsyncRoutePush();

	return (
		<Button
			className="h-12 text-lg"
			disabled={props.bill.items.length === 0 || isSaving}
			onClick={() => {
				startTransition(async () => {
					const { data: billingSettingsRows } =
						await billingSettingsStorage.select(storageDeps, {
							key: null,
							limit: 1,
						});

					const billingSettings = billingSettingsRows[0];

					const [{ data: bankTransferCzRows }, { data: lnZapRows }] =
						await Promise.all([
							billingSettings && billingSettings.value.defaultBankTransferCzKey
								? accountStorage.select(storageDeps, {
										key: billingSettings.value.defaultBankTransferCzKey,
										limit: 1,
									})
								: { data: [] },
							billingSettings && billingSettings.value.defaultLnZapKey
								? accountStorage.select(storageDeps, {
										key: billingSettings.value.defaultLnZapKey,
										limit: 1,
									})
								: { data: [] },
						]);

					const paymentOptions: StaticOfflinePayment["paymentOptions"] = [
						{
							type: "cash",
						},
					];

					(() => {
						const value = bankTransferCzRows[0];
						if (value === undefined) {
							return;
						}

						const result = value.value;
						if (result._tag !== "iban") {
							return;
						}

						paymentOptions.push({
							type: "bankTransferCZ",
							iban: result.iban,
							variableSymbol: "1",
						});
					})();

					const paymentSigner = NDKPrivateKeySigner.generate();
					const paymentNdk = new NDK({
						explicitRelayUrls: ndk.explicitRelayUrls,
						signer: paymentSigner,
					}) as NDK & {
						signer: NDKSigner;
						activeUser: NDKUser;
					};

					await paymentNdk.connect();

					if (paymentNdk.activeUser === undefined) {
						return;
					}

					await (async () => {
						const value = lnZapRows[0];
						if (value === undefined) {
							return undefined;
						}

						const result = value.value;
						if (result._tag !== "lud16") {
							return;
						}

						const btcAmount = await currencyConverter.convert({
							amount: props.total,
							sourceCurrency: props.bill.currency,
							targetCurrency: Currency.BTC,
						});

						if (btcAmount === null) {
							return;
						}

						const zapPaymentResult = await createZapPayment({
							amountInBtc: btcAmount,
							lud16: result.lud16,
							ndk,
							paymentNdk,
						});

						paymentOptions.push({
							type: "lnZap",
							amount: btcAmount,
							lnInvoice: zapPaymentResult.lnInvoice,
							walletPubkey: zapPaymentResult.walletPubkey,
							expirationIn: zapPaymentResult.expirationIn,
						});
					})();

					const id = Uuid7.random();
					const paymentData: StaticOfflinePayment = {
						bill: {
							currency: props.bill.currency,
							allowTip: false,
							items: props.bill.items.map((item) => ({
								id: item.id,
								price: item.price,
								label: item.name,
								quantity: item.quantity,
							})),
						},
						paymentOptions,
						privateKey: paymentSigner.privateKey,
					};

					await createPayment({
						paymentNdk,
						ndk,
						paymentData,
						paymentId: id,
					});

					asyncRoutePush(
						`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true`,
					).then(() => {
						deleteBill(props.billId);
					});
				});
			}}
		>
			{isSaving ? (
				<Loader2 className="animate-spin" />
			) : (
				<>
					Pay{" "}
					<motion.span
						key={props.total}
						initial={{ scale: 1.1, opacity: 0.5 }}
						animate={{ scale: 1, opacity: 1 }}
					>
						{formatAmount(props.total, props.bill.currency)}
					</motion.span>
				</>
			)}
		</Button>
	);
};

export const PosBill: React.FC<{
	billId?: string;
	bill?: Pos["bills"][string];
	defaultCurrency: Currency;
	ref?: React.Ref<HTMLDivElement>;
}> = (props) => {
	const setPos = useSetAtom(posAtom);
	const totalPerCurrency = new Map<Currency, number>();
	let hasDifferentCurrency = false;

	for (const item of props.bill?.items ?? []) {
		hasDifferentCurrency =
			hasDifferentCurrency || item.currency !== props.bill?.currency;

		totalPerCurrency.set(
			item.currency,
			(totalPerCurrency.get(item.currency) ?? 0) + item.price * item.quantity,
		);
	}

	const total =
		props.bill === undefined
			? 0
			: totalPerCurrency
					.entries()
					.reduce(
						(acc, [currency, value]) =>
							value / (props.bill?.rates[currency] ?? 1) + acc,
						0,
					);

	return (
		<>
			{/* Right Panel - Bill */}
			<div className="space-y-4" ref={props.ref}>
				<ResponsiveCard className="h-full flex flex-col w-full md:w-sm lg:w-md">
					<CardContent className="flex-1 flex flex-col">
						{/* Cart Items */}
						<div className="flex-1 overflow-hidden space-y-2">
							{props.billId !== undefined && (
								<>
									<PosBillName
										billId={props.billId}
										billLabel={props.bill !== undefined ? props.bill.label : ""}
										defaultCurrency={props.defaultCurrency}
										placeholder={`# ${props.bill?.id ?? 0}`}
									/>

									<PosBillTable
										billId={props.billId}
										billLabel={props.bill !== undefined ? props.bill.label : ""}
										defaultCurrency={props.defaultCurrency}
										table={props.bill?.table}
										placeholder={`# ${props.bill?.id ?? 0}`}
									/>
								</>
							)}

							{props.bill === undefined || props.bill.items.length === 0 ? (
								<p className="text-center">No items in cart</p>
							) : (
								props.bill.items.map((item, index) => (
									<Item
										key={item.id}
										billId={props.billId ?? ""}
										itemIndex={index}
										item={item}
										onRemove={() => {
											return setPos((prev) => {
												if (props.billId === undefined) {
													return prev;
												}

												return {
													...prev,
													bills: {
														...prev.bills,
														[props.billId]: {
															...prev.bills[props.billId],
															items: [
																...prev.bills[props.billId].items.slice(
																	0,
																	index,
																),
																...prev.bills[props.billId].items.slice(
																	index + 1,
																),
															],
														},
													},
												};
											});
										}}
									></Item>
								))
							)}
						</div>

						{/* Bill Summary */}
						{props.bill !== undefined &&
							props.billId &&
							props.bill.items.length > 0 && (
								<>
									<Separator className="my-4" />
									<div className="space-y-2">
										<div className="flex justify-between text-md font-bold">
											<span>Currency:</span>
											<span>
												<Select
													value={props.bill.currency}
													onValueChange={(value) => {
														const valueResult = z
															.enum(Currency)
															.safeParse(value);
														if (!valueResult.success) {
															return;
														}

														setPos((prev) => {
															if (props.billId === undefined) {
																return prev;
															}

															return {
																...prev,
																bills: {
																	...prev.bills,
																	[props.billId]: {
																		...prev.bills[props.billId],
																		currency: valueResult.data,
																	},
																},
															};
														});
													}}
												>
													<SelectTrigger size={"sm"} className="w-full">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{Object.values(Currency).map((currency) => (
															<SelectItem key={currency} value={currency}>
																{currency}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</span>
										</div>
									</div>

									{hasDifferentCurrency &&
										[...totalPerCurrency.entries()].map(([currency, total]) => (
											<Fragment key={currency}>
												<Separator className="my-4" />
												<div className="space-y-2">
													<div className="flex justify-between text-lg font-bold">
														<span>Total ({currency}):</span>
														<motion.span
															key={total}
															initial={{ scale: 1.1, opacity: 0.5 }}
															animate={{ scale: 1, opacity: 1 }}
														>
															{formatAmount(total, currency)}
														</motion.span>
													</div>
												</div>

												{props.bill !== undefined &&
													currency !== props.bill.currency && (
														<div className="space-y-2">
															<div className="flex justify-between text-md font-bold">
																<span>Rate:</span>
																<span>
																	<Input
																		className={"text-right"}
																		variant={"sm"}
																		type={"number"}
																		value={
																			props.bill?.rates[currency]?.toString() ??
																			"1"
																		}
																		onChange={(e) => {
																			const value = e.target.value;

																			setPos((prev) => {
																				if (props.billId === undefined) {
																					return prev;
																				}

																				return {
																					...prev,
																					bills: {
																						...prev.bills,
																						[props.billId]: {
																							...prev.bills[props.billId],
																							rates: {
																								...prev.bills[props.billId]
																									.rates,
																								[currency]: Number(value),
																							},
																						},
																					},
																				};
																			});
																		}}
																	/>
																</span>
															</div>
														</div>
													)}
											</Fragment>
										))}

									<Separator className="my-4" />
									<div className="space-y-2">
										<div className="flex justify-between text-lg font-bold">
											<span>Total:</span>
											<motion.span
												key={total}
												initial={{ scale: 1.1, opacity: 0.5 }}
												animate={{ scale: 1, opacity: 1 }}
											>
												{formatAmount(total, props.bill.currency)}
											</motion.span>
										</div>
									</div>

									<Separator className="my-4" />

									<PayButton
										bill={props.bill}
										billId={props.billId}
										total={total}
									/>
								</>
							)}
					</CardContent>
				</ResponsiveCard>
			</div>
		</>
	);
};
