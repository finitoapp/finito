"use client";

import { useRouter } from "next/navigation";
import { TableForm } from "@/app/admin/(private)/tables/table-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const router = useRouter();

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>New table</CardTitle>
				</CardHeader>
				<CardContent>
					<TableForm onSuccess={() => router.back()} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
