"use client";

import { type Mnemonic, mnemonicToOwnerSecret } from "@evolu/common";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSafeReturnTo, withReturnTo } from "@/app/onboarding/utils";
import { activateOrCreateAccountWithMnemonic } from "@/atoms/account";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const normalizeMnemonic = (value: string) =>
	value.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");

const validateMnemonic = (value: string): "ok" | "wordCount" | "invalid" => {
	const words = value.split(" ");
	if (words.length !== 24) {
		return "wordCount";
	}

	try {
		mnemonicToOwnerSecret(value as Mnemonic);
		return "ok";
	} catch {
		return "invalid";
	}
};

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const setEvoluCounter = useSetAtom(evoluCounterAtom);

	const [seed, setSeed] = useState("");
	const [errorKey, setErrorKey] = useState<null | "wordCount" | "invalid">(
		null,
	);
	const [isSaving, setIsSaving] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const normalizedSeed = normalizeMnemonic(seed);
		const validation = validateMnemonic(normalizedSeed);

		if (validation !== "ok") {
			setErrorKey(validation);
			return;
		}

		setIsSaving(true);
		setErrorKey(null);
		await activateOrCreateAccountWithMnemonic(
			deviceEvolu,
			normalizedSeed as Mnemonic,
		);
		setEvoluCounter((value) => value + 1);
		router.replace(returnTo as never);
	};

	return (
		<form onSubmit={(event) => void onSubmit(event)}>
			<Card className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
				<CardHeader>
					<CardTitle>{t("app:onboarding.restore.title")}</CardTitle>
					<CardDescription>
						{t("app:onboarding.restore.description")}
					</CardDescription>
				</CardHeader>

				<CardContent>
					<Field>
						<FieldLabel htmlFor="onboarding-seed">
							{t("settings:form.credentials-form.label.seed")}
						</FieldLabel>
						<FieldDescription>
							{t("app:onboarding.restore.description")}
						</FieldDescription>
						<Textarea
							id="onboarding-seed"
							value={seed}
							onChange={(event) => {
								setSeed(event.target.value);
								if (errorKey !== null) {
									setErrorKey(null);
								}
							}}
							rows={5}
							placeholder={t("app:onboarding.restore.seedPlaceholder")}
						/>
						{errorKey !== null && (
							<FieldError>
								{t(`app:onboarding.restore.errors.${errorKey}`)}
							</FieldError>
						)}
					</Field>
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
					<Button type="submit" disabled={isSaving}>
						{t("app:onboarding.restore.submit")}
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
