"use client";

import type { Id } from "@evolu/common";
import { useSearchParams } from "next/navigation";
import { ItemHistoryGrid } from "./item-history-grid";

export default function Home() {
	const searchParams = useSearchParams();
	const itemId = searchParams.get("id");

	if (itemId === null) {
		throw Promise.reject();
	}

	return (
		<div className="w-full lg:max-w-7xl">
			<ItemHistoryGrid itemId={itemId as Id} />
		</div>
	);
}
