"use client";

import type { Id } from "@evolu/common";
import { useSearchParams } from "next/navigation";
import { BillHistoryTable } from "./bill-history-table";

export default function Home() {
	const searchParams = useSearchParams();
	const billId = searchParams.get("id");

	if (billId === null) {
		throw Promise.reject();
	}

	return (
		<div className="w-full lg:max-w-7xl">
			<BillHistoryTable billId={billId as Id} />
		</div>
	);
}
