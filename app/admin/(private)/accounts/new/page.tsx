"use client";

import { useRouter } from "next/navigation";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const router = useRouter();

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>New account</CardTitle>
				</CardHeader>
				<CardContent>
					<AccountForm onSuccess={() => router.back()} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
