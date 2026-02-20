import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import type { TFunction } from "i18next";
import type { NotificationUI } from "@/components/notification-center";
import { backgroundTableProcessingProcess } from "@/lib/background-processing/background-table-processing-process";
import { syncFioTransfersProcess } from "@/lib/background-processing/sync-fio-transfers-process";
import { syncLnZapTransfersProcess } from "@/lib/background-processing/sync-ln-zap-transfers-process";
import { syncSparkTransfersProcess } from "@/lib/background-processing/sync-spark-transfers-process";
import { watchNdkRelaysStatusProcess } from "@/lib/background-processing/watch-ndk-relays-status-process";
import type { DeviceEvolu } from "@/lib/device-evolu";
import type { Evolu } from "@/lib/evolu";

export type BackgroundProcess = {
	name: string;
	run: (props: {
		t: TFunction;
		ndk: NDK & {
			signer: NDKSigner;
			activeUser: NDKUser;
		};
		evolu: Evolu;
		deviceEvolu: DeviceEvolu;
		addNotification: (notification: NotificationUI) => {
			update: (notification: NotificationUI) => void;
			delete: () => void;
		};
	}) => Promise<() => void>;
};

const backgroundProcesses: BackgroundProcess[] = [
	syncSparkTransfersProcess,
	syncLnZapTransfersProcess,
	syncFioTransfersProcess,
	backgroundTableProcessingProcess,
	watchNdkRelaysStatusProcess,
];

export const runBackgroundProcesses = async (
	props: Parameters<BackgroundProcess["run"]>[0],
) => {
	const unsubscribeHandlers = await Promise.all(
		backgroundProcesses.map((process) => process.run(props)),
	);
	return () => {
		for (const unsubscribe of unsubscribeHandlers) {
			unsubscribe();
		}
	};
};
