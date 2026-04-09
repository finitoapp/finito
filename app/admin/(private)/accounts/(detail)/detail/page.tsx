"use client";

import type { Id } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetAccountQuery } from "@/lib/evolu/queries/account";
import { formatIban } from "@/lib/shared/utils/format";

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const accountQuery = useMemo(
		() =>
			createGetAccountQuery({
				id: id as Id,
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(accountQuery);

	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/accounts");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"flex gap-4 flex-wrap"}>
				<ResponsiveCard className={"flex-2"}>
					<CardHeader>
						<CardTitle>{t("accounts:detail.tabs.detail")}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={t("accounts:detail.fields.type")}
									content={item._tag}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: t("accounts:detail.fields.address"),
												value: item.accountLud16
													? item.accountLud16.lud16
													: item.accountCashRegister
														? "-"
														: item.accountSpark
															? "-"
															: item.accountNwc
																? "-"
																: item.accountIban
																	? formatIban(item.accountIban.iban)
																	: "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}></div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>
			</div>
		</div>
	);
}
