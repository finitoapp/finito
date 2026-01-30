import {
	createOwnerSecret,
	createRandomBytes,
	getOrThrow,
	NonEmptyString100,
	ownerSecretToMnemonic,
	PositiveInt,
	sqliteTrue,
} from "@evolu/common";
import { faker } from "@faker-js/faker";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { defaultRelays } from "@/atoms/nostr-relays";
import { ProgressSteps } from "@/components/progress-steps";
import { Button } from "@/components/ui/button";

export function LoginForm() {
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
						label: "Creating business identity",
						description:
							currentStep === 1 ? "working..." : currentStep > 1 ? "done" : "",
					},
					{
						id: "profile",
						label: "Activating relays",
						description:
							currentStep === 2 ? "working..." : currentStep > 2 ? "done" : "",
					},
					{
						id: "preferences",
						label: "Ready",
						description:
							currentStep === 3 ? (
								"preparing..."
							) : currentStep > 3 ? (
								"yes, we're ready. Redirecting..."
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
						getOrThrow(
							deviceEvolu.insert(
								"account",
								{
									name: NonEmptyString100.orThrow(faker.internet.username()),
									mnemonic,
									lastUseAt: PositiveInt.orThrow(Date.now()),
								},
								{
									onComplete: resolve,
								},
							),
						);
					});

					setEvoluCounter((value) => value + 1);

					router.push("/admin");
				}}
			>
				Create a new account
			</Button>
		</>
	);
}
