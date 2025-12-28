"use client";

import { PaymentsTable } from "@/app/admin/(private)/payments/payments-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<PaymentsTable />
		</div>
	);
}
