"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SwitchAccountForm } from "@/app/admin/(private)/settings/switch-account/switch-account-form";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<>
			<div className={"pt-6"}>
				<LoginForm />
			</div>
			<div className="my-3 after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
				<span className="bg-card text-muted-foreground relative z-10 px-2">
					{t("settings:page.orUseExistingAccount")}
				</span>
			</div>

			<SwitchAccountForm
				onSuccess={() => {
					router.push("/admin");
				}}
			/>
		</>
	);
}
