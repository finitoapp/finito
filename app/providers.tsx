"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
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
		<I18nProvider>
			<Provider store={jotaiStore}>
				<QueryClientProvider client={browserQueryClient}>
					<TooltipProvider>
						{children}
						<Toaster />
						<GlobalDialogHost />
					</TooltipProvider>
				</QueryClientProvider>
			</Provider>
		</I18nProvider>
	);
}
