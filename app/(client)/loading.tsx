"use client";

import { useEffect, useState } from "react";
import { LoadingIndicator } from "@/components/loading-indicator";

export default function Loading() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const timeout = setTimeout(() => {
			setOpen(true);
		}, 1000);

		return () => clearTimeout(timeout);
	}, []);

	return <LoadingIndicator open={open} text={null} variant={"fullscreen"} />;
}
