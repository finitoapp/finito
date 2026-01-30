"use client";

import { sqliteTrue } from "@evolu/common";
import { Bell, X } from "lucide-react";
import { useState } from "react";
import { NotificationItem } from "@/components/notification-item";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function NotificationCenter() {
	const query = useCreateQuery(
		(db) =>
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
		[],
	);
	const { data: items } = useEvoluQuery(query);

	const [isOpen, setIsOpen] = useState(false);
	const unreadCount = items
		? items.filter((item) => item.type !== "backgroundTableProcessing").length
		: 0;

	return (
		<>
			<Button
				size="icon"
				variant="outline"
				className="relative h-8 w-8 rounded-full bg-card shadow-lg hover:bg-accent"
				onClick={() => setIsOpen(!isOpen)}
			>
				<Bell className="h-5 w-5" />
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</Button>

			<div
				className={cn(
					"fixed top-0 right-0 z-40 h-screen w-full max-w-md transform bg-card shadow-2xl transition-transform duration-300 ease-in-out",
					isOpen ? "translate-x-0" : "translate-x-full",
				)}
			>
				<div className="flex h-full flex-col safe-area-t safe-area-b">
					{/* Header */}
					<div className="flex items-center justify-between border-b border-border px-6 py-4">
						<div>
							<h2 className="text-xl font-semibold">Background Jobs</h2>
						</div>
						<div className="flex items-center gap-2">
							{unreadCount > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {}}
									className="text-xs"
								>
									Clear all
								</Button>
							)}
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setIsOpen(false)}
								className="h-8 w-8"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* Notifications List */}
					<div className="flex-1 overflow-y-auto">
						{items && items.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center px-6 text-center">
								<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
									<Bell className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mb-2 text-lg font-semibold">
									No background jobs
								</h3>
								<p className="text-sm text-muted-foreground text-pretty">
									{"You're all caught up! New notifications will appear here."}
								</p>
							</div>
						) : (
							<div className="divide-y divide-border">
								{items &&
									items.map((backgroundJob) => (
										<NotificationItem
											key={backgroundJob.id}
											notification={backgroundJob}
										/>
									))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Backdrop */}
			{isOpen && (
				<button
					type={"button"}
					className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity"
					onClick={() => setIsOpen(false)}
				/>
			)}
		</>
	);
}
