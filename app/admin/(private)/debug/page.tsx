"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNostr } from "@/hooks/use-nostr";
import { useNostrRelays } from "@/hooks/use-nostr-relays";

export default function Home() {
	const commitHash = process.env.NEXT_PUBLIC_GIT_COMMIT || "unknown";
	const { ndk } = useNostr();
	const { nostrRelays } = useNostrRelays();
	const { data: unpublishedEvents } = useQuery({
		queryKey: [],
		queryFn: () =>
			ndk.cacheAdapter && ndk.cacheAdapter.getUnpublishedEvents
				? ndk.cacheAdapter.getUnpublishedEvents()
				: null,
	});

	const getRelayStatus = ndk.cacheAdapter && ndk.cacheAdapter.getRelayStatus;

	return (
		<div className="w-full lg:max-w-7xl flex flex-col gap-4">
			<ResponsiveCard className="w-full">
				<CardHeader>
					<CardTitle>Application information</CardTitle>
				</CardHeader>
				<CardContent>
					<KeyValueList
						items={[
							{
								key: "Version",
								value: commitHash,
							},
						]}
					/>
				</CardContent>
			</ResponsiveCard>

			{ndk.cacheAdapter && (
				<ResponsiveCard className="w-full">
					<CardHeader>
						<CardTitle>Nostr Relays</CardTitle>
					</CardHeader>
					<CardContent>
						{getRelayStatus !== undefined && (
							<KeyValueList
								items={nostrRelays.map((nostrRelay) => ({
									key: nostrRelay,
									value: JSON.stringify(
										getRelayStatus.bind(ndk.cacheAdapter)(nostrRelay),
									),
								}))}
							/>
						)}
					</CardContent>

					<CardHeader>
						<CardTitle>Nostr Unpublished events</CardTitle>

						<CardContent>
							<pre className={"text-xs"}>
								{JSON.stringify(unpublishedEvents, null, 2)}
							</pre>
						</CardContent>
					</CardHeader>
				</ResponsiveCard>
			)}
		</div>
	);
}
