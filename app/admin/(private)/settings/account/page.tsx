"use client";

import { AccountForm } from "@/app/admin/(private)/settings/account/account-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNostrProfile } from "@/hooks/useNostrProfile";

export default function Home() {
	const data = useNostrProfile();

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>Account settings</CardTitle>
			</CardHeader>
			<CardContent>
				<AccountForm key={data ? "yes" : "no"} defaultValues={data ?? null} />
			</CardContent>
		</ResponsiveCard>
	);
}
