"use client";

import {
	evoluJsonArrayFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { EditIcon, ExternalLink, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { useNostr } from "@/hooks/use-nostr";
import { createQuery } from "@/lib/evolu";
import { formatAmount } from "@/lib/shared/utils/format";
import { clientBaseUrl } from "@/lib/shared/utils/window";

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const { ndk } = useNostr();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("table")
					.select((eb) => [
						"table.id as id",
						"table.createdAt as createdAt",
						"table.label as label",
						"table.numberOfSeats as numberOfSeats",

						evoluJsonArrayFrom(
							eb
								.selectFrom("tableCode")
								.select(["tableCode.code as code"] as const)
								.whereRef("tableCode.tableId", "=", "table.id")
								.where("tableCode.isDeleted", "is not", sqliteTrue)
								.where("tableCode.code", "is not", null)
								.$narrowType<{
									code: KyselyNotNull;
								}>(),
						).as("codes"),
					])
					.where("table.isDeleted", "is not", sqliteTrue)
					.where("table.label", "is not", null)
					.where("table.numberOfSeats", "is not", null)
					.where("table.id", "=", id as Id)
					.$narrowType<{
						label: KyselyNotNull;
						numberOfSeats: KyselyNotNull;
					}>();
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("table", { id: item.id, isDeleted: sqliteTrue });
			router.push("/admin/tables");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteItem();
		},
		{
			title: "Delete table?",
			description: "This action cannot be undone.",
			confirmText: "Delete",
			cancelText: "Cancel",
			confirmVariant: "destructive",
		},
	);

	const qrCode = item?.codes[0];
	const frontendUrl =
		qrCode && `${clientBaseUrl}#t-${ndk.signer.pubkey}-${qrCode.code}`;

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
							{item?.label}
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
											{item && formatAmount(item.numberOfSeats)}
										</>
									}
									className={"flex-1"}
								/>

								<StaticCard
									title={"Modified at"}
									content={
										<>
											{!item && <Skeleton />}
											{item && new Date(item.createdAt).toLocaleDateString()}
										</>
									}
									footer={item && new Date(item.createdAt).toLocaleTimeString()}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: "Name",
												value: item?.label ?? "-",
											},
											{
												key: "Number of Seats",
												value: item ? formatAmount(item.numberOfSeats) : "-",
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
							<CardTitle>{t("common:table.actions")}</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							<Button
								variant={"outline"}
								className={"w-full"}
								render={
									<Link
										href={`/admin/tables/edit?id=${encodeURIComponent(id)}`}
									/>
								}
							>
								<EditIcon />
								Edit
							</Button>
							<Button className={"w-full"} onClick={() => void onDelete()}>
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
										<Button
											render={
												<a href={frontendUrl} target={"_blank"} rel="noopener">
													<ExternalLink />
													Open
												</a>
											}
										></Button>
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
