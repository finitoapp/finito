import {
	atom,
	type SetStateAction,
	useAtomValue,
	useStore,
	type WritableAtom,
} from "jotai";
import { type ComponentProps, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import type { Button } from "@/components/ui/button";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";
import { runBackgroundProcesses } from "@/lib/background/service";

export type NotificationUI = {
	id: string;
	title: string;
	description: string;
	type: "info" | "success" | "warning" | "error";
	timestamp?: number;
	progress?: number | null; // Use null for an unknown time horizon (rotating spinner)
	canBeClosed?: boolean;
	isUnread?: boolean;
	actions?: {
		buttonProps: ComponentProps<typeof Button>;
		callback: () => unknown;
	}[];
};

const createNotificationsAtom = () =>
	atom<
		Record<
			string,
			WritableAtom<NotificationUI, [SetStateAction<NotificationUI>], void>
		>
	>({});

export const notificationsAtom = createNotificationsAtom();
export const unreadNotificationIdsAtom = atom(new Set<string>());

export const useBackgroundProcesses = () => {
	const jotaiStore = useStore();
	const evolu = useEvolu();
	const { ndk } = useNostr();
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const { t } = useTranslation();

	useEffect(() => {
		const unsubscribePromise = runBackgroundProcesses({
			addNotification: (notificationUi: NotificationUI) => {
				const notifications = jotaiStore.get(notificationsAtom);
				let currentUiAtom = notifications[notificationUi.id];
				const unreadNotificationIds = jotaiStore.get(unreadNotificationIdsAtom);
				if (currentUiAtom) {
					jotaiStore.set(currentUiAtom, notificationUi);
					if (
						notificationUi.isUnread &&
						!unreadNotificationIds.has(notificationUi.id)
					) {
						jotaiStore.set(
							unreadNotificationIdsAtom,
							new Set([...unreadNotificationIds, notificationUi.id]),
						);
					} else if (
						!notificationUi.isUnread &&
						unreadNotificationIds.has(notificationUi.id)
					) {
						const clonedUnreadNotificationIds = new Set(unreadNotificationIds);
						clonedUnreadNotificationIds.delete(notificationUi.id);
						jotaiStore.set(
							unreadNotificationIdsAtom,
							clonedUnreadNotificationIds,
						);
					}
				} else {
					currentUiAtom = atom(notificationUi);

					jotaiStore.set(notificationsAtom, {
						...notifications,
						[notificationUi.id]: currentUiAtom,
					});

					jotaiStore.set(
						unreadNotificationIdsAtom,
						new Set([...unreadNotificationIds, notificationUi.id]),
					);
				}

				return {
					update: (notificationUi: NotificationUI) => {
						const notifications = jotaiStore.get(notificationsAtom);
						const currentUiAtom = notifications[notificationUi.id];
						if (currentUiAtom) {
							const unreadNotificationIds = jotaiStore.get(
								unreadNotificationIdsAtom,
							);
							jotaiStore.set(currentUiAtom, notificationUi);
							if (
								notificationUi.isUnread &&
								!unreadNotificationIds.has(notificationUi.id)
							) {
								jotaiStore.set(
									unreadNotificationIdsAtom,
									new Set([...unreadNotificationIds, notificationUi.id]),
								);
							} else if (
								!notificationUi.isUnread &&
								unreadNotificationIds.has(notificationUi.id)
							) {
								const clonedUnreadNotificationIds = new Set(
									unreadNotificationIds,
								);
								clonedUnreadNotificationIds.delete(notificationUi.id);
								jotaiStore.set(
									unreadNotificationIdsAtom,
									clonedUnreadNotificationIds,
								);
							}
						}
					},
					delete: () => {
						const notifications = jotaiStore.get(notificationsAtom);
						if (notifications[notificationUi.id] !== undefined) {
							const newNotifications = { ...notifications };
							delete newNotifications[notificationUi.id];
							jotaiStore.set(notificationsAtom, newNotifications);

							const clonedUnreadNotificationIds = new Set(
								unreadNotificationIds,
							);
							clonedUnreadNotificationIds.delete(notificationUi.id);
							jotaiStore.set(
								unreadNotificationIdsAtom,
								clonedUnreadNotificationIds,
							);
						}
					},
				};
			},
			evolu,
			deviceEvolu,
			ndk,
			t,
		});

		return () => {
			unsubscribePromise.then((unsubscribe) => unsubscribe());
		};
	}, [evolu, deviceEvolu, ndk, jotaiStore, t]);
};
