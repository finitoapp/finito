import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/app/providers";
import { ClientOnly } from "@/components/client-only";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Finito",
	description: "Make business payments self-custody again",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={"h-dvh"}
			suppressHydrationWarning
			data-scroll-behavior="smooth"
		>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased w-full flex flex-col safe-area min-h-full`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<ClientOnly>
						<Providers>{children}</Providers>
					</ClientOnly>
				</ThemeProvider>
			</body>
		</html>
	);
}
