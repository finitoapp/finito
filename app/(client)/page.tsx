"use client";

import PaymentPage from "@/app/(client)/payment/page";
import ScanPage from "@/app/(client)/scan/page";
import { useHash } from "@/hooks/use-hash";

export default function Page(props: Record<string, unknown>) {
	const hash = useHash();
	if (hash !== null) {
		return <PaymentPage {...props} />;
	}

	return <ScanPage {...props} />;
}
