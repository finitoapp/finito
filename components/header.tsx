import { ArrowLeftIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FC } from "react";
import { Button } from "@/components/ui/button";

export const Header: FC<
	{
		title?: React.ReactNode;
		endAddon?: React.ReactNode;
	} & (
		| {
				onBackClick: () => unknown;
				backPath?: undefined;
		  }
		| {
				onBackClick?: undefined;
				backPath: Route;
		  }
		| {
				onBackClick?: undefined;
				backPath?: undefined;
		  }
	)
> = (props) => {
	const router = useRouter();

	return (
		<div
			className="fixed left-0 top-0 right-0 bg-background shadow-xs"
			style={{
				paddingTop: "env(safe-area-inset-top)",
			}}
		>
			<div className="relative flex flex-row w-full justify-center">
				<div className="max-w-xl px-4 py-3 flex flex-1 flex-row justify-start items-center gap-6 w-full">
					{props.backPath ? (
						<Link href={props.backPath}>
							<Button type={"button"} variant={"secondary"}>
								<ArrowLeftIcon />
							</Button>
						</Link>
					) : (
						<Button
							type={"button"}
							variant={"secondary"}
							onClick={props.onBackClick ?? (() => router.back())}
						>
							<ArrowLeftIcon />
						</Button>
					)}
					<h2
						className={
							"flex-1 justify-between items-center overflow-hidden text-xl font-bold text-foreground text-nowrap text-ellipsis inline-block"
						}
					>
						{props.title}
					</h2>
					{props.endAddon}
				</div>
			</div>
		</div>
	);
};
