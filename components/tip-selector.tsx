"use client";

import { useAtom } from "jotai";
import { useState } from "react";
import type { SelectedTipAtom } from "@/app/(client)/bill-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TIP_PERCENTAGES = [0, 5, 10, 15, 20];

export function TipSelector(props: { selectedTipAtom: SelectedTipAtom }) {
	const [selectedTip, setSelectedTip] = useAtom(props.selectedTipAtom);
	const [customTip, setCustomTip] = useState("");
	const [isCustom, setIsCustom] = useState(false);

	const handleTipSelect = (percentage: number) => {
		setSelectedTip(percentage);
		setIsCustom(false);
		setCustomTip("");
	};

	const handleCustomTip = (value: string) => {
		setCustomTip(value);
		setIsCustom(true);
	};

	return (
		<div className="space-y-2">
			<div className="flex gap-2">
				<div className={"flex-3 flex gap-2"}>
					{TIP_PERCENTAGES.map((percentage) => (
						<Button
							key={percentage}
							variant={
								selectedTip === percentage && !isCustom ? "primary" : "outline"
							}
							onClick={() => handleTipSelect(percentage)}
							className="h-10 flex-2"
							type={"button"}
							size={"sm"}
						>
							{percentage}%
						</Button>
					))}
				</div>
				<div className="relative flex-1">
					<Input
						type="number"
						placeholder="Custom %"
						value={customTip}
						onChange={(e) => handleCustomTip(e.target.value)}
						className={`h-10 text-center ${isCustom ? "ring-2 ring-primary" : ""}`}
						variant={"sm"}
						min="0"
						max="100"
					/>
				</div>
			</div>
		</div>
	);
}
