import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FC } from "react";
import { Button } from "@/components/ui/button";

export const Header: FC<{
	onBackClick?: () => unknown;
	title?: React.ReactNode;
	endAddon?: React.ReactNode;
}> = (props) => {
	const router = useRouter();

	return (
		<div
			className="text-center fixed left-0 top-0 right-0 bg-background shadow-xs"
			style={{
				paddingTop: "env(safe-area-inset-top)",
			}}
		>
			<div className="relative flex flex-row w-full justify-center">
				<div className="max-w-xl px-4 py-3 flex flex-1 flex-row justify-start items-center gap-6">
					<Button
						variant={"secondary"}
						onClick={props.onBackClick ?? (() => router.back())}
					>
						<ArrowLeftIcon />
					</Button>
					<div className={"flex flex-1 justify-between items-center"}>
						<h2 className="text-2xl font-bold text-foreground">
							{props.title}
						</h2>
						{props.endAddon}
					</div>
				</div>
			</div>
		</div>
	);
};
