import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { nostrRelaysAtom } from "@/atoms/nostr-relays";
import { nostrSignerAtom } from "@/atoms/nostr-signer";
import { nostrSignersAtom } from "@/atoms/nostr-signers";
import { ProgressSteps } from "@/components/progress-steps";
import { Button } from "@/components/ui/button";
import { WssUrl } from "@/lib/types";

export function LoginForm() {
	const [currentStep, setCurrentStep] = useState(0);
	const setNostrSigner = useSetAtom(nostrSignerAtom);
	const setNostrSigners = useSetAtom(nostrSignersAtom);
	const setRelays = useSetAtom(nostrRelaysAtom);
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

					const ndkSignerPayload = NDKPrivateKeySigner.generate().toPayload();
					setNostrSigners((previous) => ({
						signers: [
							...(previous !== null ? previous.signers : []),
							{
								ndkSignerPayload,
							},
						],
					}));
					setNostrSigner({
						ndkSignerPayload,
					});
					setRelays({
						relays: [
							WssUrl("wss://relay.primal.net"),
							WssUrl("wss://relay.damus.io"),
						],
					});

					router.push("/admin");
				}}
			>
				Create a new account
			</Button>
		</>
	);
}
