"use client";

import { useRouter } from "next/navigation";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";

export default function Page() {
	const router = useRouter();

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-10"} />
			<FadeHeader title={"Connected wallets"} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<AccountForm
						tagFilter={["accountSpark", "accountNwc"]}
						defaultValues={{
							_tag: "accountSpark",
						}}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
