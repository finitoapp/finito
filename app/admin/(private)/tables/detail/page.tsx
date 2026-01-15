"use client";

import { useMutation } from "@tanstack/react-query";
import { EditIcon, ExternalLink, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useNostr } from "@/hooks/use-nostr";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { formatAmount } from "@/lib/format-utils";
import { clientBaseUrl } from "@/lib/window-utils";
import { tableStorage } from "@/storages/table-storage";

export default function Home() {
	const searchParams = useSearchParams();
	const { ndk } = useNostr();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const { data: items } = useStorageSubscription(tableStorage, {
		key: id,
	});

	const item = items && items[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			await tableStorage.delete({ ndk }, item.eventId);
			router.push("/admin/tables");
		},
	});

	const qrCode = item && item.value.qrCodes && item.value.qrCodes[0];
	const frontendUrl =
		qrCode && `${clientBaseUrl}#t-${ndk.signer.pubkey}-${qrCode.id}`;

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
									title={"Number of Seats"}
									content={
										<>
											{!item && <Skeleton />}
											{item && formatAmount(item.value.numberOfSeats)}
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
												key: "Number of Seats",
												value: item
													? formatAmount(item.value.numberOfSeats)
													: "-",
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
								<Link href={`/admin/tables/edit?id=${encodeURIComponent(id)}`}>
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

					{frontendUrl && (
						<ResponsiveCard>
							<CardContent>
								{item && (
									<div className={"flex flex-col gap-2"}>
										<div className={"py-4 bg-white flex rounded"}>
											<QRCodeSVG
												className={"w-full"}
												size={256}
												value={frontendUrl}
											/>
										</div>
										<Textarea readOnly={true} value={frontendUrl} />
										<Button asChild>
											<a href={frontendUrl} target={"_blank"}>
												<ExternalLink />
												Open
											</a>
										</Button>
									</div>
								)}
							</CardContent>
						</ResponsiveCard>
					)}
				</div>
			</div>
		</div>
	);
}
