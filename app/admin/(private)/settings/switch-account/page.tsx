"use client";

import { useRouter } from "next/navigation";
import { SwitchAccountForm } from "@/app/admin/(private)/settings/switch-account/switch-account-form";
import { LoginForm } from "@/components/login-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const router = useRouter();

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>Switch account</CardTitle>
			</CardHeader>
			<CardContent>
				<div className={"pt-6"}>
					<LoginForm />
				</div>

				<div className="my-10 after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
					<span className="bg-card text-muted-foreground relative z-10 px-2">
						Or use your existing account
					</span>
				</div>

				<SwitchAccountForm
					onSuccess={() => {
						router.push("/admin");
					}}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
