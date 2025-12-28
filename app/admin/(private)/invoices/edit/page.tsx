"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { InvoiceForm } from "@/app/admin/(private)/invoices/invoice-form";
import { BackButton } from "@/components/back-button";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { invoiceStorage } from "@/storages/invoice-storage";

export default function Home() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const { data } = useStorageSubscription(invoiceStorage, {
		key: id,
	});

	const item = data && data[0];

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<InvoiceForm
				key={item ? "yes" : "no"}
				defaultValues={
					item
						? {
								...item.value,
								issueDate: new Date(item.value.issueDate),
								dueDate: new Date(item.value.dueDate),
								items: item.value.items.map((item) => ({
									...item,
									price: item.price.toFixed(),
									quantity: item.quantity.toFixed(),
									unitOfMeasure: item.unitOfMeasure ?? "",
								})),
							}
						: undefined
				}
				onSuccess={() =>
					router.push(`/admin/invoices/detail?id=${encodeURIComponent(id)}`)
				}
			/>
		</div>
	);
}
