"use client";

import { AccountsTable } from "@/app/admin/(private)/accounts/accounts-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<AccountsTable />
		</div>
	);
}
