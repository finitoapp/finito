"use client";

import { ContactTable } from "@/app/admin/(private)/contacts/contact-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl flex flex-col gap-6"}>
			<ContactTable />
		</div>
	);
}
