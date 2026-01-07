"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PaymentForm } from "@/app/(client)/receive/payment-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";
import { useNostr } from "@/hooks/use-nostr";

export default function Page() {
	const { ndk } = useNostr();
	const { data } = useSuspenseQuery({
		queryKey: [],
		queryFn: () =>
			ndk.activeUser.fetchProfile({
				skipOptimisticPublishEvent: true,
			}),
	});

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<FadeHeader title={"Receive payment"} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<PaymentForm key={data ? "yes" : "no"} onSave={() => {}} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
