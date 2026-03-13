"use client";

import { DevicesTable } from "@/app/admin/(private)/devices/devices-table";

export default function Home() {
	return (
		<div className={"w-full lg:max-w-7xl"}>
			<DevicesTable />
		</div>
	);
}
