"use client";

import { useRouter } from "next/navigation";
import { NewAccountForm } from "@/app/(client)/settings/switch-account/new-account-form";
import { SwitchAccountForm } from "@/app/admin/(private)/settings/switch-account/switch-account-form";
import { Header } from "@/components/header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";

export default function Page() {
	const router = useRouter();

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<Header title={"Switch account"} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<NewAccountForm
						onSuccess={() => {
							router.back();
						}}
					/>

					<div className="my-10 after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
						<span className="bg-card text-muted-foreground relative z-10 px-2">
							Or use your existing account
						</span>
					</div>

					<SwitchAccountForm
						onSuccess={() => {
							router.back();
						}}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
