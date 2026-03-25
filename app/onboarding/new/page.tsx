"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getSafeReturnTo, withReturnTo } from "@/app/onboarding/utils";
import {
	activateOrCreateAccountWithMnemonic,
	createAccountMnemonic,
} from "@/atoms/account";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { PasswordTextarea } from "@/components/password-textarea";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";

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

	return (
		<Card className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
			<CardHeader>
				<CardTitle>{t("app:onboarding.new.title")}</CardTitle>
				<CardDescription>{t("app:onboarding.new.description")}</CardDescription>
			</CardHeader>

			<CardContent className="grid gap-4">
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
			</CardContent>

			<CardFooter className="justify-between">
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						router.push(withReturnTo("/onboarding", returnTo) as never);
					}}
				>
					<ArrowLeftIcon />
					{t("app:onboarding.actions.back")}
				</Button>
				<Button
					type="button"
					disabled={!isBackedUp || isSaving}
					onClick={async () => {
						setIsSaving(true);
						await activateOrCreateAccountWithMnemonic(deviceEvolu, mnemonic);
						setEvoluCounter((value) => value + 1);
						router.replace(returnTo as never);
					}}
				>
					{t("app:onboarding.new.submit")}
				</Button>
			</CardFooter>
		</Card>
	);
}
