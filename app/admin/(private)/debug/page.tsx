"use client";

import { IconDownload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNostr } from "@/hooks/use-nostr";
import { useNostrRelays } from "@/hooks/use-nostr-relays";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import { downloadFile } from "@/lib/file-utils";
import type { NostrStorage } from "@/lib/nostr-storage";
import { accountStorage } from "@/storages/account-storage";
import { billingInfoStorage } from "@/storages/billing-info-storage";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";
import { clientStorage } from "@/storages/client-storage";
import { fioPluginStorage } from "@/storages/fio-plugin-storage";
import { invoiceLastNumberStorage } from "@/storages/invoice-last-number-storage";
import { invoiceNumberSeriesStorage } from "@/storages/invoice-number-series-storage";
import { invoiceStatusStorage } from "@/storages/invoice-status-storage";
import { invoiceStorage } from "@/storages/invoice-storage";
import { itemStorage } from "@/storages/item-storage";
import { notificationStorage } from "@/storages/notification-storage";
import {
	paymentFinishedStorage,
	paymentInitStorage,
	paymentReadyStorage,
} from "@/storages/payment-progress-storage";
import { paymentStatusStorage } from "@/storages/payment-status-storage";
import { paymentStorage } from "@/storages/payment-storage";
import { smtpStorage } from "@/storages/smtp-storage";
import { tableStorage } from "@/storages/table-storage";

const DownloadStorageData = () => {
	const storageDeps = useStorageDeps();
	const [isLoading, setLoading] = useState(false);

	const handleDownload = async () => {
		setLoading(true);

		try {
			const storages = [
				accountStorage,
				billingInfoStorage,
				billingSettingsStorage,
				clientStorage,
				fioPluginStorage,
				invoiceLastNumberStorage,
				invoiceNumberSeriesStorage,
				invoiceStatusStorage,
				invoiceStorage,
				itemStorage,
				notificationStorage,
				paymentInitStorage,
				paymentReadyStorage,
				paymentFinishedStorage,
				paymentStatusStorage,
				paymentStorage,
				smtpStorage,
				tableStorage,
			] satisfies Array<NostrStorage<any>>;

			const result = {} as Record<string, any>;

			for (const storage of storages) {
				const selectedData = await storage.select(storageDeps);
				result[storage.namespace] = selectedData.data;
			}

			downloadFile({
				bytes: [new Blob([JSON.stringify(result, null, 2)])],
				mimetype: "application/json",
				fileName: "finito-export.json",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button type="button" onClick={handleDownload}>
			{isLoading ? (
				<LoaderCircleIcon className="animate-spin" />
			) : (
				<IconDownload />
			)}
			Download
		</Button>
	);
};

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

			<ResponsiveCard className="w-full">
				<CardHeader>
					<CardTitle>Storage data</CardTitle>
				</CardHeader>
				<CardContent className="space-y-8">
					<div>
						Be careful. Exporting data may contain sensitive information,
						including wallet account accesses and more.
					</div>

					<div>
						<DownloadStorageData />
					</div>
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
