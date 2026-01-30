"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import { POS } from "@/components/pos/pos";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { Currency } from "@/lib/types";

export default function Home() {
	const billingSettingsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("billingSettings")
				.selectAll()
				.where("billingSettings.isDeleted", "is not", sqliteTrue)
				.where("billingSettings.id", "=", createIdFromString("")),
		[],
	);
	const { data: billingSettingsRows } = useEvoluQuery(billingSettingsQuery);

	const billingSettings = billingSettingsRows && billingSettingsRows[0];

	return (
		<div className={"w-full flex flex-col gap-6"}>
			<POS defaultCurrency={billingSettings?.defaultCurrency ?? Currency.USD} />
		</div>
	);
}
