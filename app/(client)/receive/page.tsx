"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { PaymentForm } from "@/app/(client)/receive/payment-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<FadeHeader title={t("client:page.receivePayment")} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<PaymentForm
						onSave={({ id }) => {
							router.push(`/history/detail?id=${encodeURIComponent(id)}`);
						}}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
