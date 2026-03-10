"use client";

import { sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import {
	atom,
	type SetStateAction,
	useAtomValue,
	useStore,
	type WritableAtom,
} from "jotai";
import { Bell, X } from "lucide-react";
import {
	type ComponentProps,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { NotificationItem } from "@/components/notification-item";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useNostr } from "@/hooks/use-nostr";
import { runBackgroundProcesses } from "@/lib/background/service";
import { createQuery } from "@/lib/evolu";
import { Button } from "./ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "./ui/sheet";

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

export function NotificationCenter() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const notificationUisRef = useRef<
		Record<
			string,
			{
				atom: WritableAtom<
					NotificationUI,
					[SetStateAction<NotificationUI>],
					void
				>;
				isUnread: boolean;
			}
		>
	>({});
	const { ndk } = useNostr();
	const [, setForceRender] = useState(0);
	const jotaiStore = useStore();
	const query = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("notification")
					.leftJoin(
						"notificationVerifyPayment",
						"notificationVerifyPayment.id",
						"notification.id",
					)
					.select([
						"notification.id as id",
						"notification.type as type",
						"notificationVerifyPayment.paymentId as paymentId",
						"notification.createdAt as createdAt",
					] as const)
					.where("notification.isDeleted", "is not", sqliteTrue)
					.orderBy("notification.createdAt", "desc")
					.limit(5),
			),
		[],
	);

	useEffect(() => {
		const unsubscribePromise = runBackgroundProcesses({
			addNotification: (notificationUi: NotificationUI) => {
				let currentUi = notificationUisRef.current[notificationUi.id];
				if (currentUi) {
					jotaiStore.set(currentUi.atom, notificationUi);
					currentUi.isUnread = notificationUi.isUnread === true;
				} else {
					currentUi = {
						atom: atom(notificationUi),
						isUnread: notificationUi.isUnread === true,
					};
					notificationUisRef.current[notificationUi.id] = currentUi;
				}

				setForceRender((prev) => prev + 1);

				return {
					update: (notificationUi: NotificationUI) => {
						const currentUi = notificationUisRef.current[notificationUi.id];
						if (currentUi) {
							jotaiStore.set(currentUi.atom, notificationUi);
							const currentIsUnread = currentUi.isUnread;
							currentUi.isUnread = notificationUi.isUnread === true;
							if (currentIsUnread !== currentUi.isUnread) {
								setForceRender((prev) => prev + 1);
							}
						}
					},
					delete: () => {
						delete notificationUisRef.current[notificationUi.id];
						setForceRender((prev) => prev + 1);
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
			notificationUisRef.current = {};
		};
	}, [evolu, deviceEvolu, ndk, jotaiStore, t]);

	const { data: items } = useEvoluQuery(query);

	const [isOpen, setIsOpen] = useState(false);
	const actionableItems =
		items?.filter((item) => item.type !== "backgroundTableProcessing") ?? [];
	const unreadCount = Object.values(notificationUisRef.current).filter(
		(notificationUi) => notificationUi.isUnread,
	).length;
	const { mutateAsync: clearAllNotifications, isPending: isClearingAll } =
		useMutation({
			mutationFn: async () => {
				for (const item of actionableItems) {
					evolu.update("notification", {
						id: item.id,
						isDeleted: sqliteTrue,
					});
				}
			},
		});

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>
				<Button
					size="icon"
					variant="outline"
					className="relative h-8 w-8 rounded-full bg-card shadow-lg hover:bg-accent"
					aria-label={t("components:notifications.open")}
				>
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					)}
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				showCloseButton={false}
				className="h-screen w-full max-w-md p-0"
			>
				<div className="flex h-full flex-col safe-area-t safe-area-b">
					<div className="flex items-center justify-between border-b border-border px-6 py-4">
						<div>
							<SheetTitle className="text-xl font-semibold">
								{t("components:notifications.backgroundJobs")}
							</SheetTitle>
						</div>
						<div className="flex items-center gap-2">
							{unreadCount > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => void clearAllNotifications()}
									disabled={isClearingAll}
									className="text-xs"
								>
									{t("components:notifications.clearAll")}
								</Button>
							)}
							<SheetClose asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									aria-label={t("components:notifications.close")}
								>
									<X className="h-4 w-4" />
								</Button>
							</SheetClose>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto">
						{Object.keys(notificationUisRef.current).length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center px-6 text-center">
								<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
									<Bell className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mb-2 text-lg font-semibold">
									{t("components:notifications.empty.title")}
								</h3>
								<p className="text-sm text-muted-foreground text-pretty">
									{t("components:notifications.empty.description")}
								</p>
							</div>
						) : (
							<div className="divide-y divide-border">
								{Object.entries(notificationUisRef.current).map(
									([id, notificationUi]) => (
										<NotificationItem
											key={id}
											notificationAtom={notificationUi.atom}
											deleteNotification={() => {}}
										/>
									),
								)}
							</div>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
