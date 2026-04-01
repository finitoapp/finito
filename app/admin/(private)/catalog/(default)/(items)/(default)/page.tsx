"use client";

import { ItemsTable } from "@/app/admin/(private)/catalog/items-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<ItemsTable />
		</div>
	);
}
