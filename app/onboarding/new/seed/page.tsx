"use client";

import { createIdFromString, sqliteFalse } from "@evolu/common";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	clearOnboardingSettings,
	loadOnboardingSettings,
} from "@/app/onboarding/new/state";
import { getSafeReturnTo, withReturnTo } from "@/app/onboarding/utils";
import {
	activateOrCreateAccountWithMnemonic,
	createAccountMnemonic,
} from "@/atoms/account";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { PasswordTextarea } from "@/components/password-textarea";
import { Button } from "@/components/ui/button";
import { CardDescription, CardFooter, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { createAppEvolu } from "@/lib/evolu";
import { PaymentMethod } from "@/lib/evolu/model/payment";
import { NonEmptyString255, NonNegativeInteger } from "@/lib/shared/types";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const setEvoluCounter = useSetAtom(evoluCounterAtom);

	const [mnemonic] = useState(() => createAccountMnemonic());
	const [isBackedUp, setIsBackedUp] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [settings, setSettings] = useState<ReturnType<
		typeof loadOnboardingSettings
	> | null>(null);

	useEffect(() => {
		const storedSettings = loadOnboardingSettings();
		if (storedSettings === null) {
			router.replace(withReturnTo("/onboarding/new", returnTo) as never);
			return;
		}

		setSettings(storedSettings);
	}, [router, returnTo]);

	return (
		<div className={"p-4 md:p-6 grid gap-6"}>
			<CardTitle>{t("app:onboarding.new.title")}</CardTitle>
			<CardDescription>{t("app:onboarding.new.description")}</CardDescription>

			<div className="grid gap-6">
				<div className="grid gap-2 text-sm text-muted-foreground">
					<p className="bg-muted/40 flex items-start gap-2 rounded-md px-3 py-2 leading-relaxed">
						<CheckIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
						<span>{t("app:onboarding.new.security.rules.neverShare")}</span>
					</p>
					<p className="bg-muted/40 flex items-start gap-2 rounded-md px-3 py-2 leading-relaxed">
						<CheckIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
						<span>{t("app:onboarding.new.security.rules.storeOffline")}</span>
					</p>
					<p className="bg-muted/40 flex items-start gap-2 rounded-md px-3 py-2 leading-relaxed">
						<CheckIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
						<span>{t("app:onboarding.new.security.rules.keepWordOrder")}</span>
					</p>
				</div>

				<Field>
					<FieldLabel htmlFor="onboarding-generated-seed">
						{t("settings:form.credentials-form.label.seed")}
					</FieldLabel>
					<PasswordTextarea
						id="onboarding-generated-seed"
						readOnly
						value={mnemonic}
						rows={5}
					/>
				</Field>

				<div className="flex items-center gap-3">
					<Checkbox
						id="seed-backup"
						checked={isBackedUp}
						onCheckedChange={(checked) => {
							setIsBackedUp(checked === true);
						}}
					/>
					<Label htmlFor="seed-backup">
						{t("app:onboarding.new.backupConfirmation")}
					</Label>
				</div>
			</div>

			<CardFooter className="justify-between p-0">
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						router.push(withReturnTo("/onboarding/new", returnTo) as never);
					}}
				>
					<ArrowLeftIcon />
					{t("app:onboarding.actions.back")}
				</Button>
				<Button
					type="button"
					disabled={!isBackedUp || isSaving || settings === null}
					onClick={async () => {
						if (settings === null) {
							return;
						}

						setIsSaving(true);

						try {
							await activateOrCreateAccountWithMnemonic(deviceEvolu, mnemonic, {
								accountName: NonEmptyString255(settings.accountName),
							});

							const evolu = await createAppEvolu({
								mnemonic,
								transports: [],
							});

							await new Promise<void>((resolve) => {
								evolu.upsert(
									"billingSettings",
									{
										id: createIdFromString(""),
										ownContactId: null,
										defaultInvoiceDueDateDays: NonNegativeInteger(14),
										defaultCurrency: settings.defaultCurrency,
										defaultTimezone: settings.defaultTimezone,
										defaultPaymentMethodMethod: null,
										defaultPaymentMethodBankAccountKey: null,
										defaultPaymentMethod: PaymentMethod.Cash,
										defaultBankTransferCzKey: null,
										defaultLnZapKey: null,
										defaultLnSparkKey: null,
										invoiceEmailSettingsEnable: sqliteFalse,
										invoiceEmailSettingsSubject: null,
										invoiceEmailSettingsBody: null,
									},
									{
										onComplete: resolve,
									},
								);
							});

							clearOnboardingSettings();
							setEvoluCounter((value) => value + 1);
							router.replace(returnTo as never);
						} finally {
							setIsSaving(false);
						}
					}}
				>
					{t("app:onboarding.new.settings.submit")}
				</Button>
			</CardFooter>
		</div>
	);
}
