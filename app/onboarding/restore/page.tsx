"use client";

import { Mnemonic } from "@evolu/common";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSafeReturnTo, withReturnTo } from "@/app/onboarding/utils";
import { activateOrCreateAccountWithMnemonic } from "@/atoms/account";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { Button } from "@/components/ui/button";
import { CardDescription, CardFooter, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const normalizeMnemonic = (value: string) =>
	value.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");

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

	const onSubmit = async (event: SubmitEvent) => {
		event.preventDefault();

		const normalizedSeed = normalizeMnemonic(seed);
		const validation = Mnemonic.fromUnknown(normalizedSeed);

		if (!validation.ok) {
			const words = normalizedSeed.split(" ");
			if (words.length !== 24) {
				setErrorKey("wordCount");
				return "wordCount";
			}

			setErrorKey("invalid");
			return;
		}

		setIsSaving(true);
		setErrorKey(null);
		await activateOrCreateAccountWithMnemonic(deviceEvolu, validation.value);
		setEvoluCounter((value) => value + 1);
		router.replace(returnTo as never);
	};

	return (
		<form onSubmit={(event) => void onSubmit(event)}>
			<div className={"p-4 md:p-6 grid gap-6"}>
				<CardTitle>{t("app:onboarding.restore.title")}</CardTitle>
				<CardDescription>
					{t("app:onboarding.restore.description")}
				</CardDescription>

				<div className="grid gap-6">
					<Field>
						<FieldLabel htmlFor="onboarding-seed">
							{t("settings:form.credentials-form.label.seed")}
						</FieldLabel>
						<Textarea
							id="onboarding-seed"
							autoFocus
							value={seed}
							onChange={(event) => {
								setSeed(event.target.value);
								if (errorKey !== null) {
									setErrorKey(null);
								}
							}}
							rows={5}
						/>
						{errorKey !== null && (
							<FieldError>
								{t(`app:onboarding.restore.errors.${errorKey}`)}
							</FieldError>
						)}
					</Field>
				</div>

				<CardFooter className="justify-between p-0">
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
			</div>
		</form>
	);
}
