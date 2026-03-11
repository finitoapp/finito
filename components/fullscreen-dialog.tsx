import type { FC, ReactNode } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export const FullscreenDialog: FC<{
	title: string;
	children: ReactNode;
	isOpen: boolean;
	onOpenChange?: (open: boolean) => void;
}> = (props) => {
	return (
		<Dialog open={props.isOpen} onOpenChange={props.onOpenChange}>
			<DialogContent
				className={
					// "!w-screen !max-w-none !h-screen !max-h-none !rounded-none p-0"
					"flex !max-h-[calc(100vh-3rem)] w-full !max-w-[calc(100vw-3rem)] flex-col overflow-hidden p-0"
				}
			>
				<DialogHeader
					className={"bg-background sticky top-0 z-10 border-b px-6 py-4"}
				>
					<DialogTitle>{props.title}</DialogTitle>
				</DialogHeader>
				<div className="transparent-scrollbar me-0.5 flex-1 overflow-auto px-6">
					<div className="space-y-4 text-sm">{props.children}</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
