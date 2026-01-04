"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { AccountForm } from "@/app/admin/(private)/settings/account/account-form";
import { Header } from "@/components/header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
			<Header title={"Account"} backPath={"/settings"} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardHeader>
					<CardTitle>Account settings</CardTitle>
				</CardHeader>
				<CardContent>
					<AccountForm key={data ? "yes" : "no"} defaultValues={data} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
