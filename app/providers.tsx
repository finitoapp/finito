"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { AdditionalPrecacheProgressToast } from "@/components/additional-precache-progress-toast";
import { BuildUpdateToast } from "@/components/build-update-toast";
import { GlobalDialogHost } from "@/components/global-dialog-host";
import { I18nProvider } from "@/components/i18n-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const browserQueryClient: QueryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// With SSR, we usually want to set some default staleTime
			// above 0 to avoid refetching immediately on the client
			staleTime: 60 * 1000,
		},
	},
});

const jotaiStore = createStore();

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<SerwistProvider swUrl="/sw.js">
			<I18nProvider>
				<Provider store={jotaiStore}>
					<QueryClientProvider client={browserQueryClient}>
						<TooltipProvider>
							{children}
							<Toaster />
							<AdditionalPrecacheProgressToast />
							<BuildUpdateToast />
							<GlobalDialogHost />
						</TooltipProvider>
					</QueryClientProvider>
				</Provider>
			</I18nProvider>
		</SerwistProvider>
	);
}
