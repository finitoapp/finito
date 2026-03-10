import type { Id } from "@evolu/common";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const InvoiceStatusBadge: FC<{
	invoiceId: Id;
	dueDate: Date;
}> = (props) => {
	const value = "unpaid";
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
						? "destructive"
						: "default"
			}
		>
			{value}
		</Badge>
	);
};
