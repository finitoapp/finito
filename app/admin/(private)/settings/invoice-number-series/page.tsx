"use client";

import { InvoiceLastNumberForm } from "@/app/admin/(private)/settings/invoice-number-series/invoice-last-number-form";
import { InvoiceNumberSeriesForm } from "@/app/admin/(private)/settings/invoice-number-series/invoice-number-series-form";
import { ResponsiveCard } from "@/components/responsive-card";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { invoiceLastNumberStorage } from "@/storages/invoice-last-number-storage";
import { invoiceNumberSeriesStorage } from "@/storages/invoice-number-series-storage";

export default function Home() {
	const { data } = useStorageSubscription(invoiceNumberSeriesStorage, {
		limit: 1,
	});

	const { data: lastNumberData } = useStorageSubscription(
		invoiceLastNumberStorage,
		{
			limit: 1,
		},
	);

	const item = data && data[0];
	const lastNumber = lastNumberData && lastNumberData[0];

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
										...item.value,
										serialNumberDigits:
											item.value.serialNumberDigits.toString(),
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
										...lastNumber.value,
										serialNumber: lastNumber.value.serialNumber.toString(),
										date:
											lastNumber.value.date !== null
												? new Date(lastNumber.value.date)
												: null,
									}
								: undefined
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
