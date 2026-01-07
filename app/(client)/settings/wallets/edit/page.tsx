"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { accountStorage } from "@/storages/account-storage";

export default function Page() {
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
		<div className="space-y-8 w-full px-4">
			<div className={"h-10"} />
			<FadeHeader title={"Connected wallets"} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<AccountForm
						tagFilter={["spark", "nwc"]}
						key={item ? "yes" : "no"}
						defaultValues={
							item
								? {
										...item.value,
										mnemonicVariant: "manual",
									}
								: undefined
						}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
