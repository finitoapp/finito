"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	clearOnboardingSettings,
	loadOnboardingSettings,
	saveOnboardingSettings,
} from "@/app/onboarding/new/state";
import { getSafeReturnTo, withReturnTo } from "@/app/onboarding/utils";
import { createDefaultAccountName } from "@/atoms/account";
import { Button } from "@/components/ui/button";
import { CardDescription, CardFooter, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FiatCurrency, Timezone } from "@/lib/shared/types";

type DefaultCurrency = (typeof FiatCurrency)[keyof typeof FiatCurrency];
type DefaultTimezone = (typeof Timezone)[keyof typeof Timezone];

const defaultCurrencyValues = Object.values(FiatCurrency) as DefaultCurrency[];
const defaultTimezoneValues = Object.values(Timezone) as DefaultTimezone[];

const createDefaultTimezone = (): DefaultTimezone => {
	const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	return defaultTimezoneValues.includes(resolvedTimezone as DefaultTimezone)
		? (resolvedTimezone as DefaultTimezone)
		: Timezone["Europe/Prague"];
};

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

	const [accountName, setAccountName] = useState<string>(() =>
		createDefaultAccountName(),
	);
	const [defaultCurrency, setDefaultCurrency] = useState<DefaultCurrency>(
		FiatCurrency.USD,
	);
	const [defaultTimezone, setDefaultTimezone] = useState<DefaultTimezone>(() =>
		createDefaultTimezone(),
	);
	const normalizedAccountName = accountName.trim();

	useEffect(() => {
		const storedSettings = loadOnboardingSettings();
		if (storedSettings === null) {
			return;
		}

		setAccountName(storedSettings.accountName);
		setDefaultCurrency(storedSettings.defaultCurrency);
		setDefaultTimezone(storedSettings.defaultTimezone);
	}, []);

	return (
		<div className={"p-4 md:p-6 grid gap-6"}>
			<CardTitle>{t("app:onboarding.new.settings.title")}</CardTitle>
			<CardDescription>
				{t("app:onboarding.new.settings.description")}
			</CardDescription>

			<div className="grid gap-6">
				<Field>
					<FieldLabel htmlFor="onboarding-account-name">
						{t("accounts:form.account-form.label.name")}
					</FieldLabel>
					<Input
						id="onboarding-account-name"
						value={accountName}
						onChange={(event) => {
							setAccountName(event.target.value);
						}}
						autoFocus
					/>
				</Field>

				<Field>
					<FieldLabel>
						{t("settings:form.billing-settings-form.label.default-currency")}
					</FieldLabel>
					<Select
						value={defaultCurrency}
						onValueChange={(value) => {
							setDefaultCurrency(value as DefaultCurrency);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{defaultCurrencyValues.map((currency) => (
								<SelectItem key={currency} value={currency}>
									{currency}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>

				<Field>
					<FieldLabel>
						{t("settings:form.billing-settings-form.label.timezone")}
					</FieldLabel>
					<Select
						value={defaultTimezone}
						onValueChange={(value) => {
							setDefaultTimezone(value as DefaultTimezone);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{defaultTimezoneValues.map((timezone) => (
								<SelectItem key={timezone} value={timezone}>
									{timezone}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</div>

			<CardFooter className="justify-between p-0">
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						clearOnboardingSettings();
						router.push(withReturnTo("/onboarding", returnTo) as never);
					}}
				>
					<ArrowLeftIcon />
					{t("app:onboarding.actions.back")}
				</Button>
				<Button
					type="button"
					disabled={normalizedAccountName.length === 0}
					onClick={() => {
						saveOnboardingSettings({
							accountName: normalizedAccountName,
							defaultCurrency,
							defaultTimezone,
						});
						router.push(
							withReturnTo("/onboarding/new/seed", returnTo) as never,
						);
					}}
				>
					{t("app:onboarding.new.submit")}
				</Button>
			</CardFooter>
		</div>
	);
}
