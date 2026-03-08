import type { FC } from "react";
import { LoadingIndicator } from "@/components/loading-indicator";
import type { ScreenData } from "@/lib/bill/driver";

export const LoadingScreen: FC<{
	screen: Extract<
		ScreenData,
		{
			variant: "loading";
		}
	>;
}> = (props) => {
	return (
		<LoadingIndicator
			text={props.screen.payload.text}
			open={true}
			status={props.screen.payload.status}
			variant={"fullscreen"}
		/>
	);
};
