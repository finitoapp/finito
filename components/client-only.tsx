"use client";

import type React from "react";
import { useEffect, useState } from "react";

export const ClientOnly = (props: { children: React.ReactNode }) => {
	const [hasMounted, setHasMounted] = useState(false);
	useEffect(() => {
		setHasMounted(true);
	}, []);

	if (!hasMounted) {
		return null;
	}

	return <>{props.children}</>;
};
