"use client";

import {
	createId,
	createRandomBytes,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useDebounce } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
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
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
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
import { useBill } from "@/hooks/use-bill";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useNostr } from "@/hooks/use-nostr";
import type { Pos } from "@/hooks/use-pos";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";
import { createPayment } from "@/lib/payment/service";
import {
	Currency,
	Integer,
	type NonEmptyString255,
	NonEmptyString255Schema,
	type NonNegativeInteger,
	StringToNullableStringSchema,
} from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";
import { clientBaseUrl } from "@/lib/shared/utils/window";

const Item: React.FC<{
	item: Pos["bills"][Id]["items"][number];
	billId: Id;
}> = (props) => {
	const { t } = useTranslation();
	const [isRemoving, setIsRemoving] = useState(false);
	const { removeItem, updateItemQuantity } = useBill();

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
						<h4 className="font-medium text-sm">{props.item.item.label}</h4>
						<p className="text-xs text-muted-foreground">
							{formatMoney({
								value: props.item.item.price,
								currency: props.item.item.currency,
							})}{" "}
							{t("pos:bill.each")}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<ButtonGroup>
							<Button
								disabled={props.item.quantity <= 1}
								size="sm"
								variant="outline"
								onClick={() =>
									updateItemQuantity({
										billId: props.billId,
										itemId: props.item.id,
										delta: -1,
									})
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
									updateItemQuantity({
										billId: props.billId,
										itemId: props.item.id,
										delta: 1,
									})
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
								setTimeout(() => {
									removeItem({
										billId: props.billId,
										itemId: props.item.id,
									});
								}, 200);
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
	billId?: Id;
	billLabel: string;
	placeholder: string;
}> = (props) => {
	const firstRender = useRef<string>(props.billLabel);
	const [value, setValue] = useState(props.billLabel);
	const { setBillLabel } = useBill();
	const debouncedValue = useDebounce(value, 300);

	useEffect(() => {
		if (firstRender.current === debouncedValue) {
			return;
		}

		firstRender.current = debouncedValue;
		if (props.billId === undefined) {
			return;
		}

		const debouncedValueResult = StringToNullableStringSchema.pipe(
			NonEmptyString255Schema.nullable(),
		).safeParse(debouncedValue);
		if (!debouncedValueResult.success) {
			return;
		}

		setBillLabel({
			billId: props.billId,
			label: debouncedValueResult.data,
		});
	}, [debouncedValue, setBillLabel, props.billId]);

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
	const { t } = useTranslation();
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
								? t("pos:bill.table-not-selected")
								: undefined
						}
					>
						<QrCodeIcon />
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("pos:bill.tableQrCode")}</DialogTitle>
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
	billId?: Id;
	table?: {
		id: Id;
		label: NonEmptyString255;
		// qrCode?: NonEmptyString255;
	};
}> = (props) => {
	const { t } = useTranslation();
	const { setBillTable } = useBill();
	const tableQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("table")
					.select(["table.id as id", "table.label as label"] as const)
					.where("table.isDeleted", "is not", sqliteTrue)
					.where("table.label", "is not", null)
					.$narrowType<{
						label: KyselyNotNull;
					}>(),
			),
		[],
	);
	const { data: items } = useEvoluQuery(tableQuery);
	const tableCodesQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("tableCode")
					.select([
						"tableCode.id as id",
						"tableCode.code as code",
						"tableCode.tableId as tableId",
					] as const)
					.where("tableCode.isDeleted", "is not", sqliteTrue)
					.where("tableCode.code", "is not", null)
					.where("tableCode.tableId", "is not", null)
					.$narrowType<{
						code: KyselyNotNull;
						tableId: KyselyNotNull;
					}>(),
			),
		[],
	);
	const { data: tableCodes } = useEvoluQuery(tableCodesQuery);

	const table = items.find((item) => item.id === props.table?.id);
	const tableQrCode = table
		? tableCodes.find((tableCode) => tableCode.tableId === table.id)
		: undefined;

	return (
		<div className={"flex gap-2"}>
			<ComboboxDefault
				items={(items ?? []).map((item) => ({
					value: {
						id: item.id,
						name: item.label,
					},
					label: item.label,
				}))}
				placeholder={t("pos:bill.selectTable")}
				value={
					props.table
						? {
								id: props.table.id,
								name: props.table.label,
							}
						: null
				}
				compareFunction={(a, b) => a?.id === b?.id}
				formatCustomValue={(value) => value.name}
				onChange={(value) => {
					if (props.billId === undefined) {
						return;
					}

					setBillTable({
						billId: props.billId,
						tableId: (value?.id as Id | undefined) ?? null,
					});
				}}
			/>
			<TableQrCode tableQrCode={tableQrCode?.code} />
		</div>
	);
};

const PayButton: FC<{
	bill: Pos["bills"][Id];
	billId: Id;
	total: Integer;
}> = (props) => {
	const { t } = useTranslation();
	const { ndk } = useNostr();
	const evolu = useEvolu();
	const [isSaving, startTransition] = useTransition();
	const { deleteBill } = useBill();
	const asyncRoutePush = useAsyncRoutePush();

	return (
		<Button
			className="h-12 text-lg"
			disabled={props.bill.items.length === 0 || isSaving}
			onClick={() => {
				startTransition(async () => {
					// const billingSettingsRows = await evolu.loadQuery(
					// 	createQuery((db) =>
					// 		db
					// 			.selectFrom("billingSettings")
					// 			.selectAll()
					// 			.where("isDeleted", "is not", sqliteTrue)
					// 			.where("id", "=", createIdFromString("")),
					// 	),
					// );
					//
					// const billingSettings = billingSettingsRows[0];
					//
					// const [bankTransferCzRows, lnZapRows] = await Promise.all([
					// 	(async () => {
					// 		if (
					// 			!billingSettings ||
					// 			!billingSettings.defaultBankTransferCzKey
					// 		) {
					// 			return [];
					// 		}
					//
					// 		return await evolu.loadQuery(
					// 			createQuery((db) =>
					// 				db
					// 					.selectFrom("account")
					// 					.leftJoin("accountIban", "accountIban.id", "account.id")
					// 					.select([
					// 						"account._tag as _tag",
					// 						"accountIban.iban as iban",
					// 					] as const)
					// 					.where("account.isDeleted", "is not", sqliteTrue)
					// 					.where(
					// 						"account.id",
					// 						"=",
					// 						billingSettings.defaultBankTransferCzKey as Id,
					// 					),
					// 			),
					// 		);
					// 	})(),
					// 	(async () => {
					// 		if (!billingSettings || !billingSettings.defaultLnZapKey) {
					// 			return [];
					// 		}
					//
					// 		return await evolu.loadQuery(
					// 			createQuery((db) =>
					// 				db
					// 					.selectFrom("account")
					// 					.leftJoin("accountLud16", "accountLud16.id", "account.id")
					// 					.select([
					// 						"account._tag as _tag",
					// 						"accountLud16.lud16 as lud16",
					// 					] as const)
					// 					.where("account.isDeleted", "is not", sqliteTrue)
					// 					.where(
					// 						"account.id",
					// 						"=",
					// 						billingSettings.defaultLnZapKey as Id,
					// 					),
					// 			),
					// 		);
					// 	})(),
					// ]);
					//
					// const paymentOptions: StaticOfflinePayment["paymentOptions"] = [
					// 	{
					// 		type: "cash",
					// 	},
					// ];
					//
					// (() => {
					// 	const value = bankTransferCzRows[0];
					// 	if (value === undefined) {
					// 		return;
					// 	}
					//
					// 	if (value._tag !== "accountIban" || !value.iban) {
					// 		return;
					// 	}
					//
					// 	paymentOptions.push({
					// 		type: "bankTransferCZ",
					// 		iban: value.iban,
					// 		variableSymbol: "1",
					// 	});
					// })();
					//
					// const paymentSigner = NDKPrivateKeySigner.generate();
					// const paymentNdk = new NDK({
					// 	explicitRelayUrls: ndk.explicitRelayUrls,
					// 	signer: paymentSigner,
					// }) as NDK & {
					// 	signer: NDKSigner;
					// 	activeUser: NDKUser;
					// };
					//
					// await paymentNdk.connect();
					//
					// if (paymentNdk.activeUser === undefined) {
					// 	return;
					// }
					//
					// await (async () => {
					// 	const value = lnZapRows[0];
					// 	if (value === undefined) {
					// 		return undefined;
					// 	}
					//
					// 	if (value._tag !== "accountLud16" || !value.lud16) {
					// 		return;
					// 	}
					//
					// 	const btcAmount = await currencyConverter.convert({
					// 		amount: props.total,
					// 		sourceCurrency: props.bill.currency,
					// 		targetCurrency: Currency.BTC,
					// 	});
					//
					// 	if (btcAmount === null) {
					// 		return;
					// 	}
					//
					// 	const zapPaymentResult = await createZapPayment({
					// 		amountInSats: btcAmount,
					// 		lud16: value.lud16,
					// 		ndk,
					// 		paymentNdk,
					// 	});
					//
					// 	paymentOptions.push({
					// 		type: "lnZap",
					// 		amount: btcAmount,
					// 		lnInvoice: zapPaymentResult.lnInvoice,
					// 		walletPubkey: zapPaymentResult.walletPubkey,
					// 		expirationIn: extractExpirationFromLightningInvoice(
					// 			zapPaymentResult.lnInvoice,
					// 		),
					// 	});
					// })();
					//
					// const paymentData: StaticOfflinePayment = {
					// 	bill: {
					// 		currency: props.bill.currency,
					// 		allowTip: false,
					// 		items: props.bill.items.map((item) => ({
					// 			id: item.id,
					// 			price: item.price,
					// 			label: item.name,
					// 			quantity: item.quantity,
					// 		})),
					// 	},
					// 	paymentOptions,
					// 	privateKey: NonEmptyString(paymentSigner.privateKey),
					// };

					const id = await createPayment({
						evolu,
						ndk,
						payment: {
							id: createId({
								randomBytes: createRandomBytes(),
							}),
							currency: props.bill.currency,
						},
						totalAmount: props.total as NonNegativeInteger,
						tipAmount: null,
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
					{t("pos:bill.pay")}{" "}
					<motion.span
						key={props.total}
						initial={{ scale: 1.1, opacity: 0.5 }}
						animate={{ scale: 1, opacity: 1 }}
					>
						{formatMoney({ value: props.total, currency: props.bill.currency })}
					</motion.span>
				</>
			)}
		</Button>
	);
};

export const PosBill: React.FC<{
	billId: Id | undefined;
	bill?: Pos["bills"][Id];
	ref?: React.Ref<HTMLDivElement>;
}> = (props) => {
	const { t } = useTranslation();
	const { setBillCurrency, setBillRate } = useBill();
	const totalPerCurrency = new Map<Currency, Integer>();
	let hasDifferentCurrency = false;
	const billId = props.billId;

	for (const item of props.bill?.items ?? []) {
		hasDifferentCurrency =
			hasDifferentCurrency || item.item.currency !== props.bill?.currency;

		totalPerCurrency.set(
			item.item.currency,
			Integer(
				(totalPerCurrency.get(item.item.currency) ?? 0) +
					Math.round(item.item.price * item.quantity),
			),
		);
	}

	const total =
		props.bill === undefined
			? Integer(0)
			: Integer(
					totalPerCurrency.entries().reduce((acc, [currency, value]) => {
						const rate = props.bill?.rates.find(
							(rate) => rate.currency === currency,
						);

						return Math.round(value / (rate?.rate ?? 1)) + acc;
					}, 0),
				);

	return (
		<>
			{/* Right Panel - Bill */}
			<div className="space-y-4" ref={props.ref}>
				<ResponsiveCard className="flex flex-col w-full md:w-sm lg:w-md">
					<CardContent className="flex-1 flex flex-col">
						{/* Cart Items */}
						<div className="flex-1 overflow-hidden space-y-2">
							{props.billId !== undefined && (
								<>
									<PosBillName
										billId={props.billId}
										billLabel={props.bill?.label ?? ""}
										placeholder={`# ${props.bill?.id ?? 0}`}
									/>

									<PosBillTable
										billId={props.billId}
										table={props.bill?.table ?? undefined}
									/>
								</>
							)}

							{props.bill === undefined ||
							props.bill.items.length === 0 ||
							billId === undefined ? (
								<p className="text-center">{t("pos:bill.noItemsInCart")}</p>
							) : (
								props.bill.items.map((item) => (
									<Item key={item.id} billId={billId} item={item}></Item>
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
											<span>{t("pos:bill.currency")}</span>
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
														if (props.billId === undefined) {
															return;
														}

														setBillCurrency({
															billId: props.billId,
															currency: valueResult.data,
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
														<span>
															{t("pos:bill.totalPerCurrency", { currency })}
														</span>
														<motion.span
															key={total}
															initial={{ scale: 1.1, opacity: 0.5 }}
															animate={{ scale: 1, opacity: 1 }}
														>
															{formatMoney({ value: total, currency })}
														</motion.span>
													</div>
												</div>

												{props.bill !== undefined &&
													currency !== props.bill.currency && (
														<div className="space-y-2">
															<div className="flex justify-between text-md font-bold">
																<span>{t("pos:bill.rate")}</span>
																<span>
																	<Input
																		className={"text-right"}
																		type={"number"}
																		value={
																			props.bill?.rates
																				.find(
																					(rate) => rate.currency === currency,
																				)
																				?.rate.toString() ?? "1"
																		}
																		onChange={(e) => {
																			const value = e.target.value;
																			if (props.billId === undefined) {
																				return;
																			}

																			setBillRate({
																				billId: props.billId,
																				currency,
																				rate: Number(value),
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
											<span>{t("pos:bill.total")}</span>
											<motion.span
												key={total}
												initial={{ scale: 1.1, opacity: 0.5 }}
												animate={{ scale: 1, opacity: 1 }}
											>
												{formatMoney({
													value: total,
													currency: props.bill.currency,
												})}
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
