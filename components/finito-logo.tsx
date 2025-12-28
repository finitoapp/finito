import { HandCoinsIcon } from "lucide-react";
import type React from "react";
import type { FC } from "react";
import { cn } from "@/lib/utils";

export const FinitoLogo: FC<React.ComponentProps<"div">> = ({
	className,
	...props
}) => (
	<div
		className={cn(
			"flex items-center font-semibold text-primary gap-1",
			className,
		)}
		{...props}
	>
		<HandCoinsIcon width={"1em"} height={"1em"} />
		<span>
			Fin<strong className={"text-foreground"}>ito</strong>
		</span>
	</div>
);
