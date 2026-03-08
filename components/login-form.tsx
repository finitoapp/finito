import {
	createOwnerSecret,
	createRandomBytes,
	ownerSecretToMnemonic,
} from "@evolu/common";
import { faker } from "@faker-js/faker";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { ProgressSteps } from "@/components/progress-steps";
import { Button } from "@/components/ui/button";
import { NonEmptyString255, TimestampMs } from "@/lib/shared/types";

export function LoginForm() {
	const { t } = useTranslation();
	const [currentStep, setCurrentStep] = useState(0);
	const setEvoluCounter = useSetAtom(evoluCounterAtom);
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const router = useRouter();

	return (
		<>
			<ProgressSteps
				steps={[
					{
						id: "account",
						label: t("components:loginForm.steps.account.label"),
						description:
							currentStep === 1
								? t("components:loginForm.steps.account.status.working")
								: currentStep > 1
									? t("components:loginForm.steps.account.status.done")
									: "",
					},
					{
						id: "profile",
						label: t("components:loginForm.steps.profile.label"),
						description:
							currentStep === 2
								? t("components:loginForm.steps.profile.status.working")
								: currentStep > 2
									? t("components:loginForm.steps.profile.status.done")
									: "",
					},
					{
						id: "preferences",
						label: t("components:loginForm.steps.preferences.label"),
						description:
							currentStep === 3 ? (
								t("components:loginForm.steps.preferences.status.preparing")
							) : currentStep > 3 ? (
								t("components:loginForm.steps.preferences.status.redirecting")
							) : (
								<>&nbsp;</>
							),
					},
				]}
				currentStep={currentStep}
			/>

			<Button
				type={"button"}
				className={"w-full mt-4"}
				onClick={async () => {
					if (currentStep !== 0) {
						return;
					}

					// Fake progress
					setCurrentStep(1);
					await new Promise((resolve) => setTimeout(resolve, 2000));
					setCurrentStep(2);
					await new Promise((resolve) => setTimeout(resolve, 1000));
					setCurrentStep(3);
					await new Promise((resolve) => setTimeout(resolve, 1000));
					setCurrentStep(4);
					await new Promise((resolve) => setTimeout(resolve, 1000));

					const mnemonic = ownerSecretToMnemonic(
						createOwnerSecret({
							randomBytes: createRandomBytes(),
						}),
					);

					await new Promise<void>((resolve) => {
						deviceEvolu.insert(
							"account",
							{
								name: NonEmptyString255(faker.internet.username()),
								mnemonic,
								lastUseAt: TimestampMs(Date.now()),
							},
							{
								onComplete: resolve,
							},
						);
					});

					setEvoluCounter((value) => value + 1);

					router.push("/admin");
				}}
			>
				{t("components:loginForm.actions.createNewAccount")}
			</Button>
		</>
	);
}
