"use client";

import { InvoicesTable } from "@/app/admin/(private)/invoices/invoices-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<InvoicesTable />
		</div>
	);
}
