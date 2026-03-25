import type { Metadata } from "next";
import { OnboardingGuard } from "@/components/onboarding-guard";

export const metadata: Metadata = {
	title: "Finito POS",
	description: "Make business payments self-custody again",
	manifest: "/admin/manifest.webmanifest",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <OnboardingGuard>{children}</OnboardingGuard>;
}
