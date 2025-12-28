"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNostr } from "@/hooks/use-nostr";

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

const NostrProvider = () => {
	useNostr(); // Just to ensure NDK is ready

	return null;
};

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<Provider store={jotaiStore}>
			<QueryClientProvider client={browserQueryClient}>
				<TooltipProvider>
					<NostrProvider />
					{children}
				</TooltipProvider>
			</QueryClientProvider>
		</Provider>
	);
}
