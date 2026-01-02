import type { Metadata } from "next";

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
	return <>{children}</>;
}
