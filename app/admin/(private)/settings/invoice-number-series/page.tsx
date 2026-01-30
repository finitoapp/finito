"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import { InvoiceLastNumberForm } from "@/app/admin/(private)/settings/invoice-number-series/invoice-last-number-form";
import { InvoiceNumberSeriesForm } from "@/app/admin/(private)/settings/invoice-number-series/invoice-number-series-form";
import { ResponsiveCard } from "@/components/responsive-card";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export default function Home() {
	const itemId = createIdFromString("");
	const seriesQuery = useCreateQuery(
		(db) => {
			return db
				.selectFrom("invoiceNumberSeries")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", itemId);
		},
		[itemId],
	);

	const lastNumberQuery = useCreateQuery(
		(db) => {
			return db
				.selectFrom("invoiceLastNumber")
				.select(["id", "serialNumber", "date"])
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", itemId);
		},
		[itemId],
	);

	const { data: seriesData } = useEvoluQuery(seriesQuery);
	const { data: lastNumberData } = useEvoluQuery(lastNumberQuery);

	const item = seriesData && seriesData[0];
	const lastNumber = lastNumberData && lastNumberData[0];
	console.log(item, lastNumber);

	return (
		<div className={"flex flex-col gap-4"}>
			<ResponsiveCard className="w-full max-w-xl">
				<CardHeader>
					<CardTitle>Invoice number series</CardTitle>
				</CardHeader>
				<CardContent>
					<InvoiceNumberSeriesForm
						key={item ? "yes" : "no"}
						defaultValues={
							item
								? {
										...item,
										serialNumberDigits: item.serialNumberDigits.toString(),
									}
								: undefined
						}
					/>
				</CardContent>
			</ResponsiveCard>

			<ResponsiveCard className="w-full max-w-xl">
				<CardHeader>
					<CardTitle>Last invoice number</CardTitle>
				</CardHeader>
				<CardHeader>
					<CardDescription>
						The values are used when calculating the subsequent invoice number
					</CardDescription>
				</CardHeader>
				<CardContent>
					<InvoiceLastNumberForm
						key={lastNumber ? "yes" : "no"}
						defaultValues={
							lastNumber
								? {
										...lastNumber,
										serialNumber: lastNumber.serialNumber.toString(),
										date: lastNumber.date ? new Date(lastNumber.date) : null,
									}
								: undefined
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
