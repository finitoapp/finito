"use client";

import {
	createId,
	createIdFromString,
	createRandomBytes,
	sqliteTrue,
} from "@evolu/common";
import { useDebounce } from "@uidotdev/usehooks";
import { BitcoinIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FadeHeader } from "@/components/fade-header";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";
import { currencyConverter } from "@/lib/integrations/currency-converter/currency-converter";
import { createPayment } from "@/lib/payment/service";
import {
	Currency,
	FiatCurrency,
	Integer,
	type Integer as IntegerType,
	NonNegativeIntegerSchema,
	StringToNumberSchema,
} from "@/lib/shared/types";
import { cn } from "@/lib/shared/ui/cn";
import {
	currencyFractionDigits,
	decimalStringToMinorUnits,
	minorUnitsToDecimalStringForUI,
} from "@/lib/shared/zod/money-codec";

type SourceField = "fiat" | "sats";
type ConversionStatus = "idle" | "loading" | "unavailable";

const isAllowedFiatValue = (value: string, currency: FiatCurrency): boolean => {
	if (value === "") {
		return true;
	}

	if (!/^\d+(\.\d*)?$/.test(value)) {
		return false;
	}

	const fractionPart = value.split(".")[1] ?? "";
	return fractionPart.length <= currencyFractionDigits[currency];
};

const parseSourceAmount = (props: {
	value: string;
	sourceField: SourceField;
	fiatCurrency: FiatCurrency;
}): IntegerType | null => {
	const normalized = props.value.trim();

	if (normalized === "") {
		return null;
	}

	if (props.sourceField === "sats") {
		if (!/^\d+$/.test(normalized)) {
			return null;
		}

		return Integer(Number(normalized));
	}

	const fiatValue = normalized.endsWith(".")
		? normalized.slice(0, -1)
		: normalized;

	if (fiatValue === "") {
		return null;
	}

	return decimalStringToMinorUnits({
		value: fiatValue,
		currency: props.fiatCurrency,
	});
};

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const { ndk } = useNostr();
	const [accountOptions, setAccountOptions] = useState<
		Array<{ id: string; name: string }>
	>([]);
	const [selectedAccountId, setSelectedAccountId] = useState<Id | null>(null);
	const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>(
		FiatCurrency.CZK,
	);
	const [sourceField, setSourceField] = useState<SourceField>("fiat");
	const [fiatAmount, setFiatAmount] = useState("");
	const [satsAmount, setSatsAmount] = useState("");
	const [note, setNote] = useState("");
	const [_conversionStatus, setConversionStatus] =
		useState<ConversionStatus>("idle");
	const requestIdRef = useRef(0);

	const debouncedFiatAmount = useDebounce(fiatAmount, 300);
	const debouncedSatsAmount = useDebounce(satsAmount, 300);
	const selectedAccountName =
		accountOptions.find((account) => account.id === selectedAccountId)?.name ??
		null;

	const billingSettingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("billingSettings")
					.select(["defaultCurrency"])
					.where("isDeleted", "is not", sqliteTrue)
					.where("defaultCurrency", "is not", null)
					.where("id", "=", createIdFromString("")),
			),
		[],
	);
	const accountsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("account")
					.select(["account.id as id", "account.name as name"] as const)
					.where("account.isDeleted", "is not", sqliteTrue)
					.where("account._tag", "=", "accountSpark"),
			),
		[],
	);

	useEffect(() => {
		let ignore = false;

		void evolu.loadQuery(billingSettingsQuery).then((rows) => {
			const defaultCurrency = rows[0]?.defaultCurrency;

			if (
				!ignore &&
				defaultCurrency !== null &&
				defaultCurrency !== undefined
			) {
				setFiatCurrency(defaultCurrency);
			}
		});

		return () => {
			ignore = true;
		};
	}, [billingSettingsQuery, evolu]);

	useEffect(() => {
		let ignore = false;

		void evolu.loadQuery(accountsQuery).then((rows) => {
			if (ignore) {
				return;
			}

			const nextOptions = rows.flatMap((row) =>
				row.name === null ? [] : [{ id: row.id, name: row.name }],
			);

			setAccountOptions(nextOptions);
			setSelectedAccountId((currentValue) => {
				if (
					currentValue !== null &&
					nextOptions.some((option) => option.id === currentValue)
				) {
					return currentValue;
				}

				return nextOptions[0]?.id ?? null;
			});
		});

		return () => {
			ignore = true;
		};
	}, [accountsQuery, evolu]);

	useEffect(() => {
		const sourceAmount =
			sourceField === "fiat" ? debouncedFiatAmount : debouncedSatsAmount;
		const parsedAmount = parseSourceAmount({
			value: sourceAmount,
			sourceField,
			fiatCurrency,
		});
		const targetCurrency = sourceField === "fiat" ? "BTC" : fiatCurrency;
		const clearTarget = () => {
			if (sourceField === "fiat") {
				setSatsAmount("");
				return;
			}

			setFiatAmount("");
		};
		const setTargetValue = (value: string) => {
			if (sourceField === "fiat") {
				setSatsAmount(value);
				return;
			}

			setFiatAmount(value);
		};

		if (parsedAmount === null) {
			clearTarget();
			setConversionStatus("idle");
			return;
		}

		const currentRequestId = ++requestIdRef.current;
		setConversionStatus("loading");

		void (async () => {
			const result =
				sourceField === "fiat"
					? await currencyConverter.convert({
							amount: parsedAmount,
							sourceCurrency: fiatCurrency,
							targetCurrency: "BTC",
						})
					: await currencyConverter.convert({
							amount: parsedAmount,
							sourceCurrency: "BTC",
							targetCurrency: fiatCurrency,
						});

			if (currentRequestId !== requestIdRef.current) {
				return;
			}

			if (result === null) {
				clearTarget();
				setConversionStatus("unavailable");
				return;
			}

			setTargetValue(
				minorUnitsToDecimalStringForUI({
					value: result,
					currency: targetCurrency,
				}),
			);
			setConversionStatus("idle");
		})();
	}, [debouncedFiatAmount, debouncedSatsAmount, fiatCurrency, sourceField]);

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<FadeHeader title={t("client:page.receivePayment")} />

			<div className={"w-full p-8 flex flex-col gap-8"}>
				<Field>
					<FieldLabel>
						{t("payments:form.payment-form.label.spark-wallet-account")}
					</FieldLabel>
					<Select
						value={selectedAccountId ?? "_"}
						onValueChange={(value) =>
							setSelectedAccountId(value === "_" ? null : (value as Id))
						}
						disabled={accountOptions.length === 0}
					>
						<SelectTrigger className="w-full">
							<span
								className={cn(
									"flex flex-1 text-left",
									selectedAccountName === null && "text-muted-foreground",
								)}
							>
								{selectedAccountName ??
									t("client:receiveAmountForm.account.placeholder")}
							</span>
						</SelectTrigger>
						<SelectContent>
							{accountOptions.length === 0 ? (
								<SelectItem value="_" disabled>
									{t("client:receiveAmountForm.account.empty")}
								</SelectItem>
							) : (
								accountOptions.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name}
									</SelectItem>
								))
							)}
						</SelectContent>
					</Select>
				</Field>

				<Field>
					<FieldLabel>{t("client:receiveAmountForm.amountLabel")}</FieldLabel>
					<div className="overflow-hidden rounded-xl border border-input bg-background shadow-xs">
						<div className={cn("px-4 py-3 transition-colors", "bg-muted/40")}>
							<InputGroup className="h-auto border-0 bg-transparent shadow-none dark:bg-transparent">
								<InputGroupInput
									autoFocus
									inputMode="decimal"
									value={fiatAmount}
									onFocus={() => setSourceField("fiat")}
									onChange={(event) => {
										const nextValue = event.target.value.replace(",", ".");

										if (!isAllowedFiatValue(nextValue, fiatCurrency)) {
											return;
										}

										setSourceField("fiat");
										setFiatAmount(nextValue);
									}}
								/>
								<InputGroupAddon
									align="inline-end"
									className="pr-0 font-bold text-primary"
								>
									{fiatCurrency}
								</InputGroupAddon>
							</InputGroup>
						</div>

						<div className="mx-4 border-t border-border/70" />

						<div className={cn("px-4 py-3 transition-colors", "bg-muted/40")}>
							<InputGroup className="h-auto border-0 bg-transparent shadow-none dark:bg-transparent">
								<InputGroupInput
									inputMode="numeric"
									value={satsAmount}
									onFocus={() => setSourceField("sats")}
									onChange={(event) => {
										const nextValue = event.target.value;

										if (!/^\d*$/.test(nextValue)) {
											return;
										}

										setSourceField("sats");
										setSatsAmount(nextValue);
									}}
								/>
								<InputGroupAddon
									align="inline-end"
									className="pr-0 font-bold text-primary"
								>
									sats
								</InputGroupAddon>
							</InputGroup>
						</div>
					</div>
				</Field>

				<Field>
					<FieldLabel>
						{t("client:form.payment-form.label.note-for-recipient-optional")}
					</FieldLabel>
					<Input
						className="py-2"
						value={note}
						onChange={(event) => setNote(event.target.value)}
					/>
				</Field>

				<Button
					size={"lg"}
					disabled={
						selectedAccountId === null ||
						satsAmount === "" ||
						satsAmount === "0"
					}
					onClick={async () => {
						if (selectedAccountId === null) {
							return;
						}

						const totalAmountResult = StringToNumberSchema.pipe(
							NonNegativeIntegerSchema,
						).safeDecode(satsAmount);
						if (!totalAmountResult.success) {
							console.error("Invalid total amount:", totalAmountResult.error);
							return;
						}

						const id = await createPayment({
							evolu,
							ndk,
							totalAmount: totalAmountResult.data,
							tipAmount: null,
							payment: {
								id: createId({
									randomBytes: createRandomBytes(),
								}),
								currency: Currency.BTC,
							},
							paymentLnSpark: {
								accountId: selectedAccountId,
								amount: totalAmountResult.data,
							},
						});
						router.push(`/history/detail?id=${encodeURIComponent(id)}`);
					}}
				>
					<BitcoinIcon className={"size-5"} />{" "}
					{t("payments:form.payment-form.save-label.create-invoice")}
				</Button>
			</div>
		</div>
	);
}
