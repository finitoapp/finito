"use client";

import { useRouter } from "next/navigation";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { Header } from "@/components/header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";

export default function Page() {
	const router = useRouter();

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-10"} />
			<Header title={"Connected wallets"} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<AccountForm
						tagFilter={["spark", "nwc"]}
						defaultValues={{
							_tag: "spark",
						}}
						onSuccess={() => router.push("/settings/wallets")}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
