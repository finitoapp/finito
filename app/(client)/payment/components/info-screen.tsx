import type { FC } from "react";
import { LoadingIndicator } from "@/components/loading-indicator";
import type { ScreenData } from "@/lib/bill/driver";

export const InfoScreen: FC<{
	screen: Extract<
		ScreenData,
		{
			variant: "info";
		}
	>;
}> = (props) => {
	return (
		<div className={"mb-28 flex flex-col grow"}>
			<div
				className={
					"w-full flex h-full pb-80 flex-col items-center gap-12 justify-evenly"
				}
			>
				<LoadingIndicator
					text={props.screen.payload.text}
					open={true}
					status={props.screen.payload.status}
				/>
			</div>
		</div>
	);
};
