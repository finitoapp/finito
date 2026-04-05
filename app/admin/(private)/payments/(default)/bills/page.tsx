"use client";

import { BillsTable } from "@/app/admin/(private)/payments/(default)/bills/bills-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<BillsTable />
		</div>
	);
}
