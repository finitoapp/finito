import { type Atom, useAtomValue } from "jotai";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Info,
	X,
} from "lucide-react";
import type { ComponentProps } from "react";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/shared/ui/cn";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

type NotificationUI = {
	id: string;
	title: string;
	description: string;
	type: "info" | "success" | "warning" | "error";
	timestamp?: number;
	progress?: number | null; // Use null for an unknown time horizon (rotating spinner)
	canBeClosed?: boolean;
	actions?: {
		buttonProps: ComponentProps<typeof Button>;
		callback: (params: { deleteNotification: () => unknown }) => unknown;
	}[];
} | null;

export function NotificationItem({
	notificationAtom,
	deleteNotification,
}: {
	notificationAtom: Atom<NotificationUI>;
	deleteNotification: () => void;
}) {
	const notificationUi = useAtomValue(notificationAtom);
	if (notificationUi === null) {
		return null;
	}

	const getIcon = () => {
		switch (notificationUi.type) {
			case "success":
				return <CheckCircle2 className="h-5 w-5 text-green-500" />;
			case "error":
				return <AlertCircle className="h-5 w-5 text-red-500" />;
			case "warning":
				return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
			default:
				return <Info className="h-5 w-5 text-blue-500" />;
		}
	};

	const getAccentColor = () => {
		switch (notificationUi.type) {
			case "success":
				return "border-l-green-500";
			case "error":
				return "border-l-red-500";
			case "warning":
				return "border-l-yellow-500";
			default:
				return "border-l-blue-500";
		}
	};

	const actionComponents = notificationUi.actions
		? notificationUi.actions.map((action, index) => (
				<Button
					key={index.toString()}
					{...action.buttonProps}
					onClick={() => {
						action.callback({
							deleteNotification: deleteNotification,
						});
					}}
				/>
			))
		: [];

	return (
		<div
			className={cn(
				"group relative border-l-4 bg-card px-6 py-4 transition-colors hover:bg-accent",
				getAccentColor(),
			)}
		>
			<div className="flex gap-4">
				<div className="shrink-0 pt-0.5">{getIcon()}</div>
				<div className="flex-1 space-y-2">
					<div className="flex items-start justify-between gap-2">
						<div className="flex-1 space-y-1">
							<h3 className="font-semibold leading-none">
								{notificationUi.title}
							</h3>
							<p className="text-sm text-muted-foreground">
								{notificationUi.description}
							</p>
						</div>
						{notificationUi.canBeClosed && (
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
								onClick={() => {}}
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>
					{notificationUi.progress !== undefined && (
						<div className="space-y-1">
							<Progress value={notificationUi.progress} className="h-1.5" />
							<p className="text-xs text-muted-foreground">
								{notificationUi.progress}%
							</p>
						</div>
					)}
					{notificationUi.timestamp && (
						<p className="text-xs text-muted-foreground">
							{new Date(notificationUi.timestamp).toLocaleTimeString()}
						</p>
					)}
					{actionComponents.length > 0 && actionComponents.length > 1 ? (
						<ButtonGroup>{actionComponents}</ButtonGroup>
					) : (
						actionComponents
					)}
				</div>
			</div>
		</div>
	);
}
