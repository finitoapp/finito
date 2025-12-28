"use client";

import { useMutation } from "@tanstack/react-query";
import { EditIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Barcode from "react-barcode";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNostr } from "@/hooks/use-nostr";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { formatAmount } from "@/lib/format-utils";
import { itemStorage } from "@/storages/item-storage";

export default function Home() {
	const searchParams = useSearchParams();
	const { ndk } = useNostr();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const { data: items } = useStorageSubscription(itemStorage, {
		key: id,
	});

	const item = items && items[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			await itemStorage.delete(ndk, item.eventId);
			router.push("/admin/items");
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
							{item?.value.label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={"Price"}
									content={
										<>
											{!item && <Skeleton />}
											{item &&
												`${formatAmount(item.value.price.value, item.value.price.currency)}${item.value.unitOfMeasure ? ` / ${item.value.unitOfMeasure}` : ""}`}
										</>
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
												key: "Name",
												value: item?.value.label ?? "-",
											},
											{
												key: "Price",
												value: item
													? formatAmount(
															item.value.price.value,
															item.value.price.currency,
														)
													: "-",
											},
											{
												key: "Unit of measure",
												value: item?.value.unitOfMeasure ?? "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: "Product code",
												value: item?.value.productCode
													? `${item.value.productCode.type} ${item.value.productCode.code}`
													: "-",
												help: "Setting up a product code makes it easier to work with a barcode reader.",
											},
											{
												key: "Internal code (SKU)",
												value: item?.value.internalCode ?? "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}></div>
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
								<Link href={`/admin/items/edit?id=${encodeURIComponent(id)}`}>
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

					{item && item.value.productCode && (
						<ResponsiveCard>
							<CardHeader>
								<CardTitle>Barcode</CardTitle>
							</CardHeader>
							<CardContent>
								<div className={"flex flex-col gap-2"}>
									<div className={"bg-white flex rounded justify-center"}>
										<Barcode
											value={item.value.productCode.code}
											displayValue={true}
										/>
									</div>
								</div>
							</CardContent>
						</ResponsiveCard>
					)}
				</div>
			</div>
		</div>
	);
}
