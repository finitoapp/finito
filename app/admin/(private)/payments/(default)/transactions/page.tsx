"use client";

import { TransactionsTable } from "@/app/admin/(private)/payments/(default)/transactions/transactions-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<TransactionsTable />
		</div>
	);
}
