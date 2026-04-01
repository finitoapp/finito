"use client";

import { CategoriesTable } from "@/app/admin/(private)/catalog/categories/categories-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<CategoriesTable />
		</div>
	);
}
