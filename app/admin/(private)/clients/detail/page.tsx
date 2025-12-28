"use client";

import { useMutation } from "@tanstack/react-query";
import { EditIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNostr } from "@/hooks/use-nostr";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { clientStorage } from "@/storages/client-storage";

export default function Home() {
	const searchParams = useSearchParams();
	const { ndk } = useNostr();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const { data: items } = useStorageSubscription(clientStorage, {
		key: id,
	});

	const item = items && items[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			await clientStorage.delete(ndk, item.eventId);
			router.push("/admin/clients");
		},
	});

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<ResponsiveCard className={"flex-2"}>
					<CardHeader>
						<CardTitle>
							{!item && <Skeleton />}
							{item?.value.label ?? item?.value.name}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={"VAT Number"}
									content={
										item ? item.value.countrySpecific.vatNumber : <Skeleton />
									}
									className={"flex-1"}
								/>

								<StaticCard
									title={"Modified at"}
									content={
										<>
											{!item && <Skeleton />}
											{item &&
												new Date(item.createdAt * 1000).toLocaleDateString()}
										</>
									}
									footer={
										item && new Date(item.createdAt * 1000).toLocaleTimeString()
									}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: "Company name",
												value: item?.value.name ?? "-",
											},
											{
												key: "Street",
												value: item?.value.address?.street ?? "-",
											},
											{
												key: "City",
												value: item?.value.address?.city ?? "-",
											},
											{
												key: "Postal Code",
												value: item?.value.address?.postalCode ?? "-",
											},
											{
												key: "Country",
												value: item?.value.countrySpecific?.countryCode ?? "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: "VAT Number",
												value: item?.value.countrySpecific.vatNumber ?? "-",
											},
											{
												key: "Identification Number",
												value:
													item?.value.countrySpecific?.identificationNumber ??
													"-",
											},
											{
												key: "E-mail",
												value: item?.value.email ?? "-",
											},
										]}
									/>
								</div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>

				<div className={"flex-1 flex flex-col gap-4"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>Actions</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link href={`/admin/clients/edit?id=${encodeURIComponent(id)}`}>
									<EditIcon />
									Edit
								</Link>
							</Button>
							<Button className={"w-full"} onClick={() => deleteItem()}>
								<Trash2Icon />
								Delete
							</Button>
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}
