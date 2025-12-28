"use client";

import { FioPluginForm } from "@/app/admin/(private)/settings/fio-plugin/fio-plugin-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { fioPluginStorage } from "@/storages/fio-plugin-storage";

export default function Home() {
	const { data } = useStorageSubscription(fioPluginStorage, {
		limit: 1,
	});

	const item = data && data[0];

	return (
		<div className={"w-full lg:max-w-4xl"}>
			<ResponsiveCard>
				<CardHeader>
					<CardTitle>Fio bank plugin</CardTitle>
				</CardHeader>
				<CardContent>
					<FioPluginForm
						key={data ? "yes" : "no"}
						defaultValues={
							item
								? {
										...item.value,
										numberOfSecondsBetweenChecks:
											item.value.numberOfSecondsBetweenChecks.toString(),
									}
								: undefined
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
