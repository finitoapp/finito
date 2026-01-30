import { CheckIcon, DeleteIcon, XIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CalculatorButton: React.FC<React.ComponentProps<typeof Button>> = (
	props,
) => (
	<Button
		variant={"secondary"}
		size="icon"
		{...props}
		className={cn(props.className, [
			"basis-0 flex-1 grow h-16 text-xl [&_svg]:size-6",
		])}
	/>
);

export const PosDial: React.FC<{
	onSubmit: (value: number) => unknown;
}> = (props) => {
	const [value, setValue] = useState("");
	const createEvent = (eventValue: string) => () => {
		setValue((value) => value + eventValue);
	};

	return (
		<div className={"flex flex-col gap-2 p-1"}>
			<div className={"flex flex-col pb-4"}>
				<div className={"border-1 w-full p-4 rounded-md"}>
					<div className={"text-right text-2xl"}>
						{value.replace(".", ",") || <>&nbsp;</>}
					</div>
				</div>
			</div>
			<div className={"flex flex-row gap-2"}>
				<CalculatorButton onClick={createEvent("7")}>7</CalculatorButton>
				<CalculatorButton onClick={createEvent("8")}>8</CalculatorButton>
				<CalculatorButton onClick={createEvent("9")}>9</CalculatorButton>
				<CalculatorButton
					onClick={() => setValue((value) => value.slice(0, -1))}
				>
					<DeleteIcon className="size-1" />
				</CalculatorButton>
			</div>
			<div className={"flex flex-row gap-2"}>
				<CalculatorButton onClick={createEvent("4")}>4</CalculatorButton>
				<CalculatorButton onClick={createEvent("5")}>5</CalculatorButton>
				<CalculatorButton onClick={createEvent("6")}>6</CalculatorButton>
				<CalculatorButton>??</CalculatorButton>
			</div>
			<div className={"flex flex-row gap-2"}>
				<CalculatorButton onClick={createEvent("1")}>1</CalculatorButton>
				<CalculatorButton onClick={createEvent("2")}>2</CalculatorButton>
				<CalculatorButton onClick={createEvent("3")}>3</CalculatorButton>
				<CalculatorButton>
					<XIcon className="size-1" />
				</CalculatorButton>
			</div>
			<div className={"flex flex-row gap-2"}>
				<div className={"flex flex-row basis-0 grow"}>
					<CalculatorButton onClick={createEvent("0")}>0</CalculatorButton>
				</div>
				<div className={"flex flex-row basis-0 grow gap-2"}>
					<CalculatorButton
						onClick={value.includes(".") ? undefined : createEvent(".")}
					>
						,
					</CalculatorButton>
					<CalculatorButton
						onClick={() => {
							if (value !== "") {
								props.onSubmit(parseFloat(value));
								setValue("");
							}
						}}
					>
						<CheckIcon className="size-1" />
					</CalculatorButton>
				</div>
			</div>
		</div>
	);
};
