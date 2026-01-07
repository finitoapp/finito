"use client";

import DashboardPage from "@/app/(client)/dashboard/page";
import PaymentPage from "@/app/(client)/payment/page";
import { useHash } from "@/hooks/use-hash";

export default function Page(props: Record<string, unknown>) {
	const hash = useHash();
	if (hash !== null) {
		return <PaymentPage {...props} />;
	}

	return <DashboardPage {...props} />;
}
