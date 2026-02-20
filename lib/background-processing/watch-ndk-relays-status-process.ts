import { createIdFromString } from "@evolu/common";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKRelayStatus } from "@nostr-dev-kit/ndk";
import type { BackgroundProcess } from "@/lib/background-processing/background-process";

type RelayStatusRow = {
	url: string;
	status: string;
	isConnected: boolean;
};

const notificationId = createIdFromString("watchNdkRelaysStatus");
const refreshIntervalMs = 15_000;

const relayStatusToLabel = (status: NDKRelayStatus) => {
	switch (status) {
		case NDKRelayStatus.DISCONNECTING:
			return "disconnecting";
		case NDKRelayStatus.DISCONNECTED:
			return "disconnected";
		case NDKRelayStatus.RECONNECTING:
			return "reconnecting";
		case NDKRelayStatus.FLAPPING:
			return "flapping";
		case NDKRelayStatus.CONNECTING:
			return "connecting";
		case NDKRelayStatus.CONNECTED:
			return "connected";
		case NDKRelayStatus.AUTH_REQUESTED:
			return "auth requested";
		case NDKRelayStatus.AUTHENTICATING:
			return "authenticating";
		case NDKRelayStatus.AUTHENTICATED:
			return "authenticated";
		default:
			return "unknown";
	}
};

const isRelayConnected = (status: NDKRelayStatus) =>
	status === NDKRelayStatus.CONNECTED ||
	status === NDKRelayStatus.AUTHENTICATED;

const collectRelayStatuses = (ndk: NDK): RelayStatusRow[] =>
	Array.from(ndk.pool.relays.values()).map((relay) => ({
		url: relay.url,
		status: relayStatusToLabel(relay.status),
		isConnected: isRelayConnected(relay.status),
	}));

const createDescription = (statuses: ReadonlyArray<RelayStatusRow>) => {
	if (statuses.length === 0) {
		return "No NDK relays configured.";
	}

	const connected = statuses.filter((relay) => relay.isConnected).length;
	const lines = [`Connected ${connected}/${statuses.length} relays.`];

	for (const relay of statuses) {
		lines.push(`${relay.url} -> ${relay.status}`);
	}

	return lines.join("\n");
};

const resolveNotificationType = (
	statuses: ReadonlyArray<RelayStatusRow>,
): "info" | "success" | "warning" | "error" => {
	if (statuses.length === 0) return "warning";
	const connected = statuses.filter((relay) => relay.isConnected).length;
	if (connected === statuses.length) return "success";
	if (connected === 0) return "error";
	return "warning";
};

export const watchNdkRelaysStatusProcess: BackgroundProcess = {
	name: "watchNdkRelaysStatus",
	run: async (props) => {
		const notification = props.addNotification({
			title: "NDK relay status",
			type: "info",
			progress: null,
			canBeClosed: true,
			description: "Checking relays...",
			isUnread: false,
			id: notificationId,
			timestamp: Date.now(),
			actions: [
				{
					buttonProps: {
						children: "Refresh",
					},
					callback: () => {
						updateNotification();
					},
				},
			],
		});

		const updateNotification = () => {
			const statuses = collectRelayStatuses(props.ndk);

			notification.update({
				title: "NDK relay status",
				type: resolveNotificationType(statuses),
				progress: null,
				canBeClosed: true,
				description: createDescription(statuses),
				isUnread: statuses.find((relay) => !relay.isConnected) !== undefined,
				id: notificationId,
				timestamp: Date.now(),
				actions: [
					{
						buttonProps: {
							children: "Refresh",
						},
						callback: () => {
							updateNotification();
						},
					},
				],
			});
		};

		const onRelayChange = () => {
			updateNotification();
		};

		props.ndk.pool.on("relay:connecting", onRelayChange);
		props.ndk.pool.on("relay:connect", onRelayChange);
		props.ndk.pool.on("relay:ready", onRelayChange);
		props.ndk.pool.on("relay:disconnect", onRelayChange);

		updateNotification();

		const interval = globalThis.setInterval(() => {
			updateNotification();
		}, refreshIntervalMs);

		return () => {
			globalThis.clearInterval(interval);

			props.ndk.pool.off("relay:connecting", onRelayChange);
			props.ndk.pool.off("relay:connect", onRelayChange);
			props.ndk.pool.off("relay:ready", onRelayChange);
			props.ndk.pool.off("relay:disconnect", onRelayChange);
		};
	},
};
