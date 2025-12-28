"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { accountStorage } from "@/storages/account-storage";

export default function Home() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const { data } = useStorageSubscription(accountStorage, {
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
					<CardTitle>Edit account</CardTitle>
				</CardHeader>
				<CardContent>
					<AccountForm
						key={item ? "yes" : "no"}
						defaultValues={item ? item.value : undefined}
						onSuccess={() =>
							router.push(`/admin/accounts/detail?id=${encodeURIComponent(id)}`)
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
