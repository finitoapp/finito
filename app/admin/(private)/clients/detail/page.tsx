"use client";

import { type Id, kysely, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import type { NotNull } from "kysely";
import { EditIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("client")
					.select(
						(eb) =>
							[
								"client.id as id",
								"client.createdAt as createdAt",
								"client.name as name",
								"client.label as label",
								"client.email as email",
								"client.countryCode as countryCode",

								kysely
									.jsonObjectFrom(
										eb
											.selectFrom("clientAddress")
											.select([
												"clientAddress.street as street",
												"clientAddress.descriptiveNumber as descriptiveNumber",
												"clientAddress.city as city",
												"clientAddress.postalCode as postalCode",
											])
											.whereRef("clientAddress.id", "=", "client.id")
											.where("client.isDeleted", "is not", sqliteTrue),
									)
									.as("address"),

								kysely
									.jsonObjectFrom(
										eb
											.selectFrom("clientCz")
											.select([
												"clientCz.vatPayer as vatPayer",
												"clientCz.identificationNumber as identificationNumber",
												"clientCz.vatNumber as vatNumber",
												"clientCz.caseNumber as caseNumber",
											])
											.whereRef("clientCz.id", "=", "client.id")
											.where("client.isDeleted", "is not", sqliteTrue),
									)
									.as("cz"),
							] as const,
					)
					.where("client.isDeleted", "is not", sqliteTrue)
					.where("client.name", "is not", null)
					.where("client.countryCode", "is not", null)
					.where("client.id", "=", id as Id)
					.$narrowType<{
						name: NotNull;
						countryCode: NotNull;
					}>();
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(query);

	const item = items[0];

	console.log("item", item, JSON.stringify(item));

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("client", { id: item.id, isDeleted: sqliteTrue });
			router.push("/admin/clients");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteItem();
		},
		{
			title: "Delete client?",
			description: "This action cannot be undone.",
			confirmText: "Delete",
			cancelText: "Cancel",
			confirmVariant: "destructive",
		},
	);

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
							{item?.label ?? item?.name}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={"VAT Number"}
									content={item ? item.cz?.vatNumber : <Skeleton />}
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
												key: "Company name",
												value: item?.name ?? "-",
											},
											{
												key: "Street",
												value: item?.address?.street ?? "-",
											},
											{
												key: "City",
												value: item?.address?.city ?? "-",
											},
											{
												key: "Postal Code",
												value: item?.address?.postalCode ?? "-",
											},
											{
												key: "Country",
												value: item?.countryCode ?? "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: "VAT Number",
												value: item?.cz?.vatNumber ?? "-",
											},
											{
												key: "Identification Number",
												value: item?.cz?.identificationNumber ?? "-",
											},
											{
												key: "E-mail",
												value: item?.email ?? "-",
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
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link href={`/admin/clients/edit?id=${encodeURIComponent(id)}`}>
									<EditIcon />
									Edit
								</Link>
							</Button>
							<Button className={"w-full"} onClick={() => void onDelete()}>
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
