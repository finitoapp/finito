"use client";


import { useTranslation } from "react-i18next";
import { type Id, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useCreateQuery(
		(db) => {
			return db
				.selectFrom("account")
				.leftJoin("accountIban", "accountIban.id", "account.id")
				.leftJoin("accountLud16", "accountLud16.id", "account.id")
				.leftJoin("accountSpark", "accountSpark.id", "account.id")
				.leftJoin("accountNwc", "accountNwc.id", "account.id")
				.leftJoin("accountCashRegister", "accountCashRegister.id", "account.id")
				.select([
					"account.id as id",
					"account.name as name",
					"account._tag as _tag",
					"accountIban.id as accountIban",
					"accountIban.iban as accountIban.iban",
					"accountIban.currency as accountIban.currency",
					"accountLud16.id as accountLud16",
					"accountLud16.lud16 as accountLud16.lud16",
					"accountSpark.id as accountSpark",
					"accountSpark.mnemonic as accountSpark.mnemonic",
					"accountNwc.id as accountNwc",
					"accountNwc.credentials as accountNwc.credentials",
					"accountCashRegister.id as accountCashRegister",
					"accountCashRegister.currency as accountCashRegister.currency",
				] as const)
				.where("account.isDeleted", "is not", sqliteTrue)
				.where("account.id", "=", id as Id);
		},
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items && items[0];
	console.log("item", item);

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("accounts:page.editAccount")}</CardTitle>
				</CardHeader>
				<CardContent>
					<AccountForm
						key={item ? "yes" : "no"}
						defaultValues={item}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
