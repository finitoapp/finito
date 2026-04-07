"use client";

import type { Id } from "@evolu/common";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { CardContent } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetContactsQuery } from "@/lib/evolu/queries/contact";

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(() => createGetContactsQuery({ id: id as Id }), [id]);
	const { data: items } = useEvoluQuery(query);
	const item = items[0];

	if (item === undefined) {
		return null;
	}

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"flex min-w-0 flex-col gap-4"}>
				<ResponsiveCard>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4 flex-wrap"}>
								<StaticCard
									title={t("contacts:detail.cards.phone")}
									content={item.phone ?? "-"}
									className={"flex-1"}
								/>

								<StaticCard
									title={t("contacts:detail.cards.vatNumber")}
									content={item.billingInfo?.cz?.vatNumber ?? "-"}
									className={"flex-1"}
								/>

								<StaticCard
									title={t("contacts:detail.cards.modifiedAt")}
									content={new Date(item.createdAt).toLocaleDateString()}
									footer={new Date(item.createdAt).toLocaleTimeString()}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: t("contacts:detail.fields.name"),
												value: item.name,
											},
											{
												key: t("contacts:detail.fields.street"),
												value: item.address?.street ?? "-",
											},
											{
												key: t("contacts:detail.fields.city"),
												value: item.address?.city ?? "-",
											},
											{
												key: t("contacts:detail.fields.postalCode"),
												value: item.address?.postalCode ?? "-",
											},
											{
												key: t("contacts:detail.fields.country"),
												value: item.billingInfo?.countryCode ?? "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: t("contacts:detail.fields.vatNumber"),
												value: item.billingInfo?.cz?.vatNumber ?? "-",
											},
											{
												key: t("contacts:detail.fields.identificationNumber"),
												value:
													item.billingInfo?.cz?.identificationNumber ?? "-",
											},
											{
												key: t("contacts:detail.fields.email"),
												value: item.email ?? "-",
											},
											{
												key: t("contacts:detail.fields.phone"),
												value: item.phone ?? "-",
											},
										]}
									/>
								</div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>
			</div>
		</div>
	);
}
