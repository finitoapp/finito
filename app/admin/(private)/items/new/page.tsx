"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ItemForm } from "@/app/admin/(private)/items/item-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvolu } from "@/hooks/use-evolu";

export default function Home() {
	const router = useRouter();
	const evolu = useEvolu();

	const [billingSettings, setBillingSettings] = useState<any>(undefined);
	useEffect(() => {
		const query = evolu.createQuery((db) =>
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
					<CardTitle>New item</CardTitle>
				</CardHeader>
				<CardContent>
					<ItemForm
						key={[billingSettings ? "true" : false].join(",")}
						onSuccess={() => router.back()}
						defaultValues={{
							priceCurrency: billingSettings?.defaultCurrency,
						}}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
