import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import type { Uuid7 } from "@/lib/types";
import { invoiceStatusStorage } from "@/storages/invoice-status-storage";

export const InvoiceStatusBadge: FC<{
	invoiceId: Uuid7;
	dueDate: Date;
}> = (props) => {
	const { data: invoiceStates } = useStorageSubscription(invoiceStatusStorage, {
		limit: 1,
		key: props.invoiceId,
	});

	const invoiceStatus = invoiceStates ? invoiceStates[0] : undefined;
	const value = invoiceStatus ? invoiceStatus.value.status : null;
	const now = new Date();

	if (value === null) {
		return <Skeleton />;
	}

	return (
		<Badge
			variant={
				value === "unpaid" && props.dueDate > now
					? "outline"
					: value === "unpaid"
						? "primary"
						: "success"
			}
		>
			{value}
		</Badge>
	);
};
