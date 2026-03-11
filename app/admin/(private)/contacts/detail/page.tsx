"use client";

import type { Id } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
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
import { createGetContactsQuery } from "@/lib/evolu/queries/contact";

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

	const query = useMemo(() => createGetContactsQuery({ id: id as Id }), [id]);
	const { data: items } = useEvoluQuery(query);
	const item = items[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("contact", { id: item.id, isDeleted: sqliteTrue });
			router.push("/admin/contacts");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteItem();
		},
		{
			title: t("contacts:detail.deleteDialog.title"),
			description: t("contacts:detail.deleteDialog.description"),
			confirmText: t("contacts:detail.deleteDialog.confirm"),
			cancelText: t("contacts:detail.deleteDialog.cancel"),
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
							<div className={"flex gap-4 flex-wrap"}>
								<StaticCard
									title={t("contacts:detail.cards.phone")}
									content={item ? (item.phone ?? "-") : <Skeleton />}
									className={"flex-1"}
								/>

								<StaticCard
									title={t("contacts:detail.cards.vatNumber")}
									content={
										item ? (
											(item.billingInfo?.cz?.vatNumber ?? "-")
										) : (
											<Skeleton />
										)
									}
									className={"flex-1"}
								/>

								<StaticCard
									title={t("contacts:detail.cards.modifiedAt")}
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
												key: t("contacts:detail.fields.name"),
												value: item?.name ?? "-",
											},
											{
												key: t("contacts:detail.fields.street"),
												value: item?.address?.street ?? "-",
											},
											{
												key: t("contacts:detail.fields.city"),
												value: item?.address?.city ?? "-",
											},
											{
												key: t("contacts:detail.fields.postalCode"),
												value: item?.address?.postalCode ?? "-",
											},
											{
												key: t("contacts:detail.fields.country"),
												value: item?.billingInfo?.countryCode ?? "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: t("contacts:detail.fields.vatNumber"),
												value: item?.billingInfo?.cz?.vatNumber ?? "-",
											},
											{
												key: t("contacts:detail.fields.identificationNumber"),
												value:
													item?.billingInfo?.cz?.identificationNumber ?? "-",
											},
											{
												key: t("contacts:detail.fields.email"),
												value: item?.email ?? "-",
											},
											{
												key: t("contacts:detail.fields.phone"),
												value: item?.phone ?? "-",
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
										href={`/admin/contacts/edit?id=${encodeURIComponent(id)}`}
									/>
								}
							>
								<EditIcon />
								{t("contacts:detail.actions.edit")}
							</Button>
							<Button className={"w-full"} onClick={() => void onDelete()}>
								<Trash2Icon />
								{t("contacts:detail.actions.delete")}
							</Button>
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}
