"use client";

import { ClientTable } from "@/app/admin/(private)/clients/client-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<ClientTable />
		</div>
	);
}
