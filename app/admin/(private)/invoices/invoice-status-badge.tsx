import { type Id, sqliteTrue } from "@evolu/common";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export const InvoiceStatusBadge: FC<{
	invoiceId: Id;
	dueDate: Date;
}> = (props) => {
	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("invoiceStatus")
				.select("status")
				.where("id", "=", props.invoiceId)
				.where("isDeleted", "is not", sqliteTrue)
				.limit(1),
		[props.invoiceId],
	);
	const { data: invoiceStates } = useEvoluQuery(query);

	const invoiceStatus = invoiceStates ? invoiceStates[0] : undefined;
	const value = invoiceStatus ? invoiceStatus.status : null;
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
