"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ItemForm } from "@/app/admin/(private)/items/item-form";
import { accountAtom } from "@/atoms/account";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const account = useAtomValue(accountAtom);

	const [billingSettings, setBillingSettings] = useState<any>(undefined);
	useEffect(() => {
		const query = createQuery((db) =>
			db
				.selectFrom("billingSettings")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", createIdFromString("")),
		);
		evolu.loadQuery(query).then((rows) => {
			setBillingSettings(rows[0]);
		});
	}, [evolu]);

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("items:page.newItem")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ItemForm
						key={[billingSettings ? "true" : false].join(",")}
						onSuccess={() => router.back()}
						defaultValues={{
							deviceId: account.device.id,
							currency: billingSettings?.defaultCurrency,
						}}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
