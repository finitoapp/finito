"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ClientForm } from "@/app/admin/(private)/clients/client-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { clientStorage } from "@/storages/client-storage";

export default function Home() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const { data } = useStorageSubscription(clientStorage, {
		key: id,
	});

	const item = data && data[0];

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>Edit client</CardTitle>
				</CardHeader>
				<CardContent>
					<ClientForm
						key={item ? "yes" : "no"}
						defaultValues={
							item
								? {
										...item.value,
										countrySpecific: {
											...item.value.countrySpecific,
											vatNumber: item.value.countrySpecific.vatNumber ?? "",
											identificationNumber:
												item.value.countrySpecific.identificationNumber ?? "",
										},
									}
								: undefined
						}
						onSuccess={() =>
							router.push(`/admin/clients/detail?id=${encodeURIComponent(id)}`)
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
