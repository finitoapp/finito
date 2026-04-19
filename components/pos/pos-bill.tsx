"use client";

import {
	createId,
	createRandomBytes,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useDebounce } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue } from "jotai";
import {
	FullscreenIcon,
	Loader2,
	MinusIcon,
	PlusIcon,
	QrCodeIcon,
	Trash2Icon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { accountAtom } from "@/atoms/account";
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
import { type Pos, usePos } from "@/hooks/use-pos";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";
import { currencyConverter } from "@/lib/integrations/currency-converter/currency-converter";
import { createPaymentWithDefaultMethods } from "@/lib/payment/service";
import {
	Currency,
	Integer,
	type NonEmptyString255,
	NonEmptyString255Schema,
	type NonNegativeInteger,
	StringToNullableStringSchema,
} from "@/lib/shared/types";
import { cn } from "@/lib/shared/ui/cn";
import { formatMoney } from "@/lib/shared/utils/format";
import { clientBaseUrl } from "@/lib/shared/utils/window";

type PosBillItem = Pos["bills"][Id]["items"][number];

const posTableQuery = createQuery((db) =>
	db
		.selectFrom("table")
		.select(["table.id as id", "table.label as label"] as const)
		.where("table.isDeleted", "is not", sqliteTrue)
		.where("table.label", "is not", null)
		.$narrowType<{
			label: KyselyNotNull;
		}>(),
);

const posTableCodesQuery = createQuery((db) =>
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
);

const calculateBillTotals = (props: {
	billCurrency: Currency;
	items: Array<{
		quantity: number;
		item: {
			price: number;
			currency: Currency;
		};
	}>;
	rates: Pos["bills"][Id]["rates"];
}) => {
	const totalPerCurrency = new Map<Currency, Integer>();
	let hasDifferentCurrency = false;

	for (const item of props.items) {
		hasDifferentCurrency =
			hasDifferentCurrency || item.item.currency !== props.billCurrency;

		totalPerCurrency.set(
			item.item.currency,
			Integer(
				(totalPerCurrency.get(item.item.currency) ?? 0) +
					Math.round(item.item.price * item.quantity),
			),
		);
	}

	const total = Integer(
		[...totalPerCurrency.entries()].reduce((acc, [currency, value]) => {
			const rate = props.rates.find((item) => item.currency === currency);

			return Math.round(value / (rate?.rate ?? 1)) + acc;
		}, 0),
	);

	return {
		total,
		totalPerCurrency,
		hasDifferentCurrency,
	};
};

const createPaymentItemFromPosItem = (
	item: PosBillItem,
	quantity?: number,
) => ({
	...item,
	quantity: quantity ?? item.quantity,
	totalAmount: Integer(
		Math.round(item.item.price * (quantity ?? item.quantity)),
	),
	optionalityChecked: null,
});

const createPosPayment = async (props: {
	evolu: ReturnType<typeof useEvolu>;
	ndk: ReturnType<typeof useNostr>["ndk"];
	deviceId: Id;
	currency: Currency;
	total: Integer;
	items: ReturnType<typeof createPaymentItemFromPosItem>[];
}) => {
	const amountInBtc =
		props.currency === Currency.BTC
			? (props.total as NonNegativeInteger)
			: (((await currencyConverter.convert({
					amount: props.total,
					sourceCurrency: props.currency,
					targetCurrency: Currency.BTC,
				})) as NonNegativeInteger | null) ?? undefined);

	return createPaymentWithDefaultMethods({
		evolu: props.evolu,
		ndk: props.ndk,
	})({
		payment: {
			id: createId({
				randomBytes: createRandomBytes(),
			}),
			deviceId: props.deviceId,
			currency: props.currency,
		},
		items: props.items,
		tipAmount: null,
		amountInBtc,
	});
};

const getBillTargetLabel = (bill: Pos["bills"][Id]) =>
	bill.table?.label ?? bill.label ?? `#${bill.displayId}`;

const Item: React.FC<{
	item: PosBillItem;
	billId: Id;
	isSplitMode?: boolean;
	selectedQuantity?: number;
	onSelectedQuantityChange?: (quantity: number) => void;
}> = (props) => {
	const { t } = useTranslation();
	const [isRemoving, setIsRemoving] = useState(false);
	const { addExistingItem } = useBill();
	const isSplitMode = props.isSplitMode === true;
	const selectedQuantity = props.selectedQuantity ?? 0;

	return (
		<AnimatePresence>
			{!isRemoving && (
				<motion.div
					className={cn(
						"flex items-center justify-between rounded-lg p-2",
						isSplitMode ? "border border-dashed bg-background" : "bg-muted",
						selectedQuantity > 0 && "border-primary/50 bg-primary/5",
					)}
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
						{isSplitMode && (
							<p className="text-xs text-muted-foreground">
								{t("pos:bill.split.selectedQuantity", {
									selected: selectedQuantity,
									total: props.item.quantity,
								})}
							</p>
						)}
					</div>
					{isSplitMode ? (
						<ButtonGroup>
							<Button
								disabled={selectedQuantity <= 0}
								size="sm"
								variant="outline"
								onClick={() =>
									props.onSelectedQuantityChange?.(selectedQuantity - 1)
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
								className={"w-14"}
								render={
									<motion.div
										key={`${props.item.itemId}:${selectedQuantity}`}
										initial={{ scale: 1.5, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
									/>
								}
							>
								{selectedQuantity}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									props.onSelectedQuantityChange?.(selectedQuantity + 1)
								}
								disabled={selectedQuantity >= props.item.quantity}
								className="h-8 w-8 p-0"
							>
								<PlusIcon className="h-3 w-3" />
							</Button>
						</ButtonGroup>
					) : (
						<div className="flex items-center gap-2">
							<ButtonGroup>
								<Button
									disabled={props.item.quantity <= 1}
									size="sm"
									variant="outline"
									onClick={() =>
										addExistingItem({
											item: props.item,
											quantity: -1,
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
									render={
										<motion.div
											key={props.item.quantity}
											initial={{ scale: 1.5, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
										/>
									}
								>
									{props.item.quantity}
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										addExistingItem({
											item: props.item,
											quantity: 1,
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
										void addExistingItem({
											item: props.item,
											quantity: -props.item.quantity,
										});
									}, 200);
								}}
								className="ml-2 h-8 w-8 p-0"
							>
								<Trash2Icon className="h-3 w-3" />
							</Button>
						</div>
					)}
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
				<DialogTrigger
					render={
						<Button
							size={"icon"}
							variant={"outline"}
							disabled={props.tableQrCode === undefined}
							title={
								props.tableQrCode === undefined
									? t("pos:bill.table-not-selected")
									: undefined
							}
						/>
					}
				>
					<QrCodeIcon />
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
				render={
					<a href={frontendUrl} target={"_blank"} rel="noopener">
						<FullscreenIcon />
					</a>
				}
			></Button>
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
	const { data: items } = useEvoluQuery(posTableQuery);
	const { data: tableCodes } = useEvoluQuery(posTableCodesQuery);

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
	const account = useAtomValue(accountAtom);

	return (
		<Button
			className="h-12 w-full text-lg"
			disabled={props.bill.items.length === 0 || isSaving}
			onClick={() => {
				startTransition(async () => {
					const id = await createPosPayment({
						evolu,
						ndk,
						deviceId: account.device.id,
						currency: props.bill.currency,
						total: props.total,
						items: props.bill.items.map((item) =>
							createPaymentItemFromPosItem(item),
						),
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
	const router = useRouter();
	const searchParams = useSearchParams();
	const pos = usePos();
	const evolu = useEvolu();
	const { ndk } = useNostr();
	const asyncRoutePush = useAsyncRoutePush();
	const account = useAtomValue(accountAtom);
	const { deleteBill, moveItemsToBill, setBillCurrency, setBillRate } =
		useBill();
	const billId = props.billId;
	const variant = searchParams.get("variant");
	const [isSplitMode, setIsSplitMode] = useState(false);
	const [selectedQuantities, setSelectedQuantities] = useState<
		Partial<Record<Id, number>>
	>({});
	const [isExistingBillDialogOpen, setIsExistingBillDialogOpen] =
		useState(false);
	const [isAnotherTableDialogOpen, setIsAnotherTableDialogOpen] =
		useState(false);
	const [selectedExistingBillId, setSelectedExistingBillId] =
		useState<Id | null>(null);
	const [selectedTableId, setSelectedTableId] = useState<Id | null>(null);
	const [isSplitPending, startSplitTransition] = useTransition();
	const { data: tables } = useEvoluQuery(posTableQuery);

	const billTotals =
		props.bill === undefined
			? {
					total: Integer(0),
					totalPerCurrency: new Map<Currency, Integer>(),
					hasDifferentCurrency: false,
				}
			: calculateBillTotals({
					billCurrency: props.bill.currency,
					items: props.bill.items,
					rates: props.bill.rates,
				});

	const selectedItems = useMemo(
		() =>
			(props.bill?.items ?? [])
				.map((item) => {
					const quantity = Math.min(
						item.quantity,
						Math.max(0, selectedQuantities[item.itemId] ?? 0),
					);
					if (quantity <= 0) {
						return null;
					}

					return {
						item,
						quantity,
					};
				})
				.filter((item): item is { item: PosBillItem; quantity: number } => {
					return item !== null;
				}),
		[props.bill?.items, selectedQuantities],
	);

	const selectedTotals =
		props.bill === undefined
			? {
					total: Integer(0),
				}
			: calculateBillTotals({
					billCurrency: props.bill.currency,
					items: selectedItems.map(({ item, quantity }) => ({
						item: item.item,
						quantity,
					})),
					rates: props.bill.rates,
				});

	const selectedItemCount = selectedItems.reduce(
		(acc, item) => acc + item.quantity,
		0,
	);
	const hasSelectedItems = selectedItemCount > 0;
	const isFullSelection =
		props.bill !== undefined &&
		props.bill.items.length > 0 &&
		selectedItems.length === props.bill.items.length &&
		selectedItems.every(({ item, quantity }) => quantity === item.quantity);

	const compatibleBills = useMemo(() => {
		if (props.bill === undefined || billId === undefined) {
			return [];
		}

		return Object.values(pos.bills)
			.filter(
				(item) => item.id !== billId && item.currency === props.bill?.currency,
			)
			.sort((a, b) => a.displayId - b.displayId);
	}, [billId, pos.bills, props.bill]);

	const otherTables = useMemo(
		() => (tables ?? []).filter((table) => table.id !== props.bill?.table?.id),
		[tables, props.bill?.table?.id],
	);

	useEffect(() => {
		const bill = props.bill;
		if (bill === undefined) {
			setSelectedQuantities({});
			return;
		}

		setSelectedQuantities((current) => {
			const next = Object.fromEntries(
				bill.items
					.map((item) => {
						const quantity = Math.min(
							item.quantity,
							Math.max(0, current[item.itemId] ?? 0),
						);
						return quantity > 0 ? [item.itemId, quantity] : null;
					})
					.filter((item): item is [Id, number] => item !== null),
			);

			return next;
		});
	}, [props.bill]);

	const getPosBillHref = (targetBillId: Id) =>
		`/admin/pos?id=${encodeURIComponent(targetBillId)}${
			variant ? `&variant=${encodeURIComponent(variant)}` : ""
		}`;

	const resetSplitState = () => {
		setIsSplitMode(false);
		setSelectedQuantities({});
		setSelectedExistingBillId(null);
		setSelectedTableId(null);
		setIsExistingBillDialogOpen(false);
		setIsAnotherTableDialogOpen(false);
	};

	const setSelectedQuantity = (item: PosBillItem, quantity: number) => {
		setSelectedQuantities((current) => {
			const nextQuantity = Math.min(item.quantity, Math.max(0, quantity));
			if (nextQuantity <= 0) {
				const next = { ...current };
				delete next[item.itemId];
				return next;
			}

			return {
				...current,
				[item.itemId]: nextQuantity,
			};
		});
	};

	const moveSelectedItems = (target: {
		targetBillId?: Id;
		targetTableId?: Id | null;
	}) => {
		if (billId === undefined || props.bill === undefined || !hasSelectedItems) {
			return;
		}

		return moveItemsToBill({
			sourceBillId: billId,
			targetBillId: target.targetBillId,
			targetTableId: target.targetTableId,
			items: selectedItems,
		});
	};

	const handleMoveToNewBill = () => {
		startSplitTransition(() => {
			const targetBillId = moveSelectedItems({
				targetTableId: props.bill?.table?.id ?? null,
			});
			if (targetBillId === undefined) {
				return;
			}

			resetSplitState();
			router.replace(getPosBillHref(targetBillId) as never);
		});
	};

	const handleMoveToExistingBill = () => {
		if (selectedExistingBillId === null) {
			return;
		}

		startSplitTransition(() => {
			const targetBillId = moveSelectedItems({
				targetBillId: selectedExistingBillId,
			});
			if (targetBillId === undefined) {
				return;
			}

			resetSplitState();
			router.replace(getPosBillHref(targetBillId) as never);
		});
	};

	const handleMoveToAnotherTable = () => {
		if (selectedTableId === null) {
			return;
		}

		startSplitTransition(() => {
			const targetBillId = moveSelectedItems({
				targetTableId: selectedTableId,
			});
			if (targetBillId === undefined) {
				return;
			}

			resetSplitState();
			router.replace(getPosBillHref(targetBillId) as never);
		});
	};

	const handlePaySelected = () => {
		const bill = props.bill;
		if (billId === undefined || bill === undefined || !hasSelectedItems) {
			return;
		}

		const paymentItems = selectedItems.map(({ item, quantity }) =>
			createPaymentItemFromPosItem(item, quantity),
		);

		startSplitTransition(async () => {
			if (isFullSelection) {
				resetSplitState();
				const paymentId = await createPosPayment({
					evolu,
					ndk,
					deviceId: account.device.id,
					currency: bill.currency,
					total: selectedTotals.total,
					items: paymentItems,
				});

				asyncRoutePush(
					`/admin/payments/detail?id=${encodeURIComponent(paymentId)}&focus=true`,
				).then(() => {
					deleteBill(billId);
				});

				return;
			}

			const targetBillId = moveSelectedItems({
				targetTableId: bill.table?.id ?? null,
			});
			if (targetBillId === undefined) {
				return;
			}

			resetSplitState();
			const paymentId = await createPosPayment({
				evolu,
				ndk,
				deviceId: account.device.id,
				currency: bill.currency,
				total: selectedTotals.total,
				items: paymentItems,
			});

			asyncRoutePush(
				`/admin/payments/detail?id=${encodeURIComponent(paymentId)}&focus=true`,
			).then(() => {
				deleteBill(targetBillId);
			});
		});
	};

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

									{isSplitMode && (
										<div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
											<p className="font-medium">{t("pos:bill.split.title")}</p>
											<p className="text-muted-foreground">
												{t("pos:bill.split.description")}
											</p>
										</div>
									)}
								</>
							)}

							{props.bill === undefined ||
							props.bill.items.length === 0 ||
							billId === undefined ? (
								<p className="text-center">{t("pos:bill.noItemsInCart")}</p>
							) : (
								props.bill.items.map((item) => (
									<Item
										key={`${item.itemId}:${item.quantity}`}
										billId={billId}
										item={item}
										isSplitMode={isSplitMode}
										selectedQuantity={selectedQuantities[item.itemId] ?? 0}
										onSelectedQuantityChange={(quantity) =>
											setSelectedQuantity(item, quantity)
										}
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

									{billTotals.hasDifferentCurrency &&
										[...billTotals.totalPerCurrency.entries()].map(
											([currency, total]) => (
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
																						(rate) =>
																							rate.currency === currency,
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
											),
										)}

									<Separator className="my-4" />
									<div className="space-y-2">
										<div className="flex justify-between text-lg font-bold">
											<span>{t("pos:bill.total")}</span>
											<motion.span
												key={billTotals.total}
												initial={{ scale: 1.1, opacity: 0.5 }}
												animate={{ scale: 1, opacity: 1 }}
											>
												{formatMoney({
													value: billTotals.total,
													currency: props.bill.currency,
												})}
											</motion.span>
										</div>
									</div>

									<Separator className="my-4" />

									{isSplitMode ? (
										<div className="space-y-3">
											<div className="rounded-lg border border-dashed bg-muted/30 p-3">
												<div className="flex items-center justify-between gap-2">
													<span className="text-sm text-muted-foreground">
														{t("pos:bill.split.selectedItems")}
													</span>
													<span className="font-medium">
														{selectedItemCount}
													</span>
												</div>
												<div className="mt-2 flex items-center justify-between gap-2">
													<span className="text-sm text-muted-foreground">
														{t("pos:bill.split.selectedTotal")}
													</span>
													<span className="font-medium">
														{formatMoney({
															value: selectedTotals.total,
															currency: props.bill.currency,
														})}
													</span>
												</div>
											</div>

											<div className="grid gap-2 sm:grid-cols-2">
												<Button
													variant="outline"
													onClick={handleMoveToNewBill}
													disabled={!hasSelectedItems || isSplitPending}
												>
													{t("pos:bill.split.moveToNewBill")}
												</Button>
												<Button
													variant="outline"
													onClick={() => {
														setSelectedExistingBillId(
															selectedExistingBillId ??
																compatibleBills[0]?.id ??
																null,
														);
														setIsExistingBillDialogOpen(true);
													}}
													disabled={
														!hasSelectedItems ||
														compatibleBills.length === 0 ||
														isSplitPending
													}
												>
													{t("pos:bill.split.moveToExistingBill")}
												</Button>
												<Button
													variant="outline"
													onClick={() => {
														setSelectedTableId(
															selectedTableId ?? otherTables[0]?.id ?? null,
														);
														setIsAnotherTableDialogOpen(true);
													}}
													disabled={
														!hasSelectedItems ||
														otherTables.length === 0 ||
														isSplitPending
													}
												>
													{t("pos:bill.split.moveToAnotherTable")}
												</Button>
												<Button
													onClick={handlePaySelected}
													disabled={!hasSelectedItems || isSplitPending}
												>
													{isSplitPending
														? t("pos:bill.split.processing")
														: t("pos:bill.split.paySelected")}
												</Button>
											</div>

											<Button
												variant="ghost"
												onClick={resetSplitState}
												disabled={isSplitPending}
											>
												{t("pos:bill.split.cancel")}
											</Button>
										</div>
									) : (
										<div className="space-y-2">
											<Button
												variant="outline"
												className="w-full"
												onClick={() => setIsSplitMode(true)}
											>
												{t("pos:bill.split.start")}
											</Button>
											<PayButton
												bill={props.bill}
												billId={props.billId}
												total={billTotals.total}
											/>
										</div>
									)}
								</>
							)}
					</CardContent>
				</ResponsiveCard>

				<Dialog
					open={isExistingBillDialogOpen}
					onOpenChange={setIsExistingBillDialogOpen}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{t("pos:bill.split.existingBillDialogTitle")}
							</DialogTitle>
						</DialogHeader>

						<div className="space-y-4">
							<Select
								value={selectedExistingBillId ?? undefined}
								onValueChange={(value) =>
									setSelectedExistingBillId(value as Id)
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue
										placeholder={t("pos:bill.split.selectExistingBill")}
									/>
								</SelectTrigger>
								<SelectContent>
									{compatibleBills.map((bill) => (
										<SelectItem key={bill.id} value={bill.id}>
											{getBillTargetLabel(bill)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<div className="flex justify-end gap-2">
								<Button
									variant="outline"
									onClick={() => setIsExistingBillDialogOpen(false)}
								>
									{t("pos:bill.split.cancel")}
								</Button>
								<Button
									onClick={handleMoveToExistingBill}
									disabled={selectedExistingBillId === null || isSplitPending}
								>
									{t("pos:bill.split.confirmMove")}
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>

				<Dialog
					open={isAnotherTableDialogOpen}
					onOpenChange={setIsAnotherTableDialogOpen}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{t("pos:bill.split.otherTableDialogTitle")}
							</DialogTitle>
						</DialogHeader>

						<div className="space-y-4">
							<Select
								value={selectedTableId ?? undefined}
								onValueChange={(value) => setSelectedTableId(value as Id)}
							>
								<SelectTrigger className="w-full">
									<SelectValue
										placeholder={t("pos:bill.split.selectAnotherTable")}
									/>
								</SelectTrigger>
								<SelectContent>
									{otherTables.map((table) => (
										<SelectItem key={table.id} value={table.id}>
											{table.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<div className="flex justify-end gap-2">
								<Button
									variant="outline"
									onClick={() => setIsAnotherTableDialogOpen(false)}
								>
									{t("pos:bill.split.cancel")}
								</Button>
								<Button
									onClick={handleMoveToAnotherTable}
									disabled={selectedTableId === null || isSplitPending}
								>
									{t("pos:bill.split.confirmMove")}
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</>
	);
};
