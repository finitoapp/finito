"use client";

import type { Id } from "@evolu/common";
import { useSearchParams } from "next/navigation";
import { ReconciliationClaimsTable } from "./reconciliation-claims-table";

export default function Home() {
	const searchParams = useSearchParams();
	const paymentId = searchParams.get("id");

	if (paymentId === null) {
		throw Promise.reject();
	}

	return (
		<div className="w-full lg:max-w-7xl">
			<ReconciliationClaimsTable paymentId={paymentId as Id} />
		</div>
	);
}
