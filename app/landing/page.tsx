import type { Metadata } from "next";
import { LandingPageClient } from "@/app/landing/landing-page-client";

export const metadata: Metadata = {
	title: "Finito Landing | Local-first payments and business operations",
	description:
		"Finito combines customer payments and business operations in one local-first product. Core usage is free and runs directly in the browser.",
	alternates: {
		canonical: "/landing",
	},
	openGraph: {
		title: "Finito | Local-first payments and operations",
		description:
			"One product for customers and businesses: payments, POS, invoices, and reservations. Core usage is free and browser-based.",
		type: "website",
		url: "/landing",
		images: [
			{
				url: "https://raw.githubusercontent.com/finitoapp/finito/main/.github/screenshot1.webp",
				width: 1200,
				height: 630,
				alt: "Finito dashboard",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Finito | Local-first payments and operations",
		description:
			"Payments, POS, invoices, reservations. Local-first, free core usage, works in the browser.",
		creator: "@finito_app",
		images: [
			"https://raw.githubusercontent.com/finitoapp/finito/main/.github/screenshot1.webp",
		],
	},
	robots: {
		index: true,
		follow: true,
	},
};

export default function Page() {
	return <LandingPageClient />;
}
