"use client";

import { MenusTable } from "@/app/admin/(private)/menus/menus-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<MenusTable />
		</div>
	);
}
