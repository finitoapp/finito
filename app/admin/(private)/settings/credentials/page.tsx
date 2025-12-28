"use client";

import { CredentialsForm } from "@/app/admin/(private)/settings/credentials/credentials-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>Credentials settings</CardTitle>
			</CardHeader>
			<CardContent>
				<CredentialsForm />
			</CardContent>
		</ResponsiveCard>
	);
}
