import type React from "react";
import { ResponsiveCard } from "@/components/responsive-card";
import {
	type Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const StaticCard: React.FC<{
	title: React.ReactNode;
	content?: React.ReactNode | undefined;
	footer?: React.ReactNode | undefined;
	className?: React.HTMLAttributes<typeof Card>["className"];
}> = (params) => {
	return (
		<ResponsiveCard className={params.className}>
			<CardHeader className={"border-0 pb-0 pt-3"}>
				<CardTitle>{params.title}</CardTitle>
			</CardHeader>
			<CardContent className="pt-2 pb-6 flex flex-col gap-2">
				{params.content && (
					<div className={"font-bold text-md md:text-2xl lg:text-3xl"}>
						{params.content}
					</div>
				)}
				{params.footer && <div className={"text-sm"}>{params.footer}</div>}
			</CardContent>
		</ResponsiveCard>
	);
};
