import { type Id, sqliteTrue } from "@evolu/common";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export const usePaymentStatus = (props: { paymentId: Id }) => {
	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("paymentStatus")
				.select(["paymentStatus.status as status"] as const)
				.where("paymentStatus.isDeleted", "is not", sqliteTrue)
				.where("paymentStatus.id", "=", props.paymentId),
		[props.paymentId],
	);
	const { data: paymentStates } = useEvoluQuery(query);

	const paymentStatus = paymentStates?.[0];
	if (paymentStatus === undefined) {
		return null;
	}

	return paymentStatus.status;
};
