"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { NewAccountForm } from "@/app/(client)/settings/switch-account/new-account-form";
import { SwitchAccountForm } from "@/app/admin/(private)/settings/switch-account/switch-account-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className="space-y-8 w-full">
			<div className={"h-8"} />
			<FadeHeader title={t("settings:page.switchAccount")} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<NewAccountForm
						onSuccess={() => {
							router.back();
						}}
					/>

					<div className="my-10 after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
						<span className="bg-card text-muted-foreground relative z-10 px-2">
							{t("settings:page.orUseExistingAccount")}
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
