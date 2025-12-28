"use client";

import { TablesTable } from "@/app/admin/(private)/tables/tables-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl"}>
			<TablesTable />
		</div>
	);
}
