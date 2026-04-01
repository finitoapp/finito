"use client";

import { WaitersTable } from "@/app/admin/(private)/venue/waiters/waiters-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl"}>
			<WaitersTable />
		</div>
	);
}
