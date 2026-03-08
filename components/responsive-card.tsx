import type { ComponentProps, FC } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/shared/ui/cn";

export const ResponsiveCard: FC<ComponentProps<typeof Card>> = (props) => {
	return (
		<Card
			{...props}
			className={cn(
				props.className,
				"max-sm:rounded-none max-sm:border-x-0 max-sm:shadow-none",
			)}
		/>
	);
};
