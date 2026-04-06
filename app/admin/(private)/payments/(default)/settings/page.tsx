"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PaymentDefaultMethodsForm } from "@/app/admin/(private)/payments/(default)/settings/payment-default-methods-form";
import { ResponsiveCard } from "@/components/responsive-card";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createPaymentDefaultMethodsQuery } from "@/lib/evolu/queries/payment-default-method";

export default function Page() {
	const { t } = useTranslation();
	const paymentDefaultMethodsQuery = useMemo(
		() => createPaymentDefaultMethodsQuery(),
		[],
	);
	const { data } = useEvoluQuery(paymentDefaultMethodsQuery);

	return (
		<ResponsiveCard className="w-full max-w-4xl">
			<CardHeader>
				<CardTitle>{t("payments:page.settings")}</CardTitle>
				<CardDescription>
					{t("payments:page.settings-description")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<PaymentDefaultMethodsForm
					defaultValues={{
						methods: data.map((method) => ({
							id: method.id as never,
							type: method.type,
							accountId: method.accountId as never,
							pausedAt: method.pausedAt as never,
							status: method.pausedAt === null ? "active" : "paused",
						})),
					}}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
