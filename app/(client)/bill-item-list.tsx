"use client";

import { motion } from "framer-motion";
import { useSetAtom } from "jotai";
import { TriangleAlertIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SelectedItemsAtom } from "@/app/(client)/bill-utils";
import { CounterCheckbox } from "@/components/counter-checkbox";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { formatMoney } from "@/lib/shared/utils/format";
import type { Currency, Integer } from "@/lib/shared/types";
import { cn } from "@/lib/shared/ui/cn";

interface NavItem {
	id: string;
	label: React.ReactNode;
	price: Integer;
	quantity: number;
	action?: React.ReactNode;
	icon?: React.ReactNode;
	active?: boolean;
	optionality?: {
		checked: number; // how many pieces are selected
	};
}

export interface Bill {
	currency: Currency;
	allowTip?: boolean;
	items: NavItem[];
}

interface VerticalNavProps {
	bill: Bill | null;
	selectedItemsAtom: SelectedItemsAtom;
	className?: string;
}

export function BillItemList({
	bill,
	className,
	selectedItemsAtom,
}: VerticalNavProps) {
	const { t } = useTranslation();

	if (bill === null || bill.items.length === 0) {
		return (
			<div
				className={cn(
					"flex flex-col justify-center items-center min-h-max",
					className,
				)}
			>
				<h3 className={"text-foreground text-2xl mt-20"}>
					{bill
						? t("client:bill.empty.emptyBill")
						: t("client:bill.empty.noBill")}
				</h3>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col", className)}>
			<nav>
				{bill.items.map((item) => (
					<NavItemComponent
						key={item.id}
						item={item}
						bill={bill}
						selectedItemsAtom={selectedItemsAtom}
					/>
				))}
			</nav>
		</div>
	);
}

function NavItemComponent({
	item,
	bill,
	selectedItemsAtom,
}: {
	item: NavItem;
	bill: Bill;
	selectedItemsAtom: SelectedItemsAtom;
}) {
	const { t } = useTranslation();
	const setSelectedItems = useSetAtom(selectedItemsAtom);
	const [checked, setChecked] = useState(
		(item.optionality && item.optionality.checked) ?? item.quantity,
	);

	const quantity =
		item.optionality === undefined
			? item.quantity
			: Math.min(item.quantity, checked);

	const quantityLeft = item.quantity - quantity;

	return (
		<div
			className={cn(
				"flex w-full items-center gap-3 px-3 py-2 text-md font-medium transition-all",
				"data-[variant=outline]:border-t-0 data-[variant=outline]:first:border-t",
				"hover:bg-accent/50",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
				"data-[state=on]:bg-accent data-[state=on]:text-accent-foreground rounded-xl",
				quantity > 0 && "text-foreground",
				quantity === 0 && "text-muted-foreground hover:text-foreground",
			)}
		>
			<div className={"p-1 flex w-full items-center"}>
				<div className="flex items-center gap-4 w-full p-0.5">
					<CounterCheckbox
						maxCount={item.quantity}
						value={quantity}
						onCountChange={(value) => {
							setChecked(value);
							setSelectedItems((values) => ({
								...values,
								[item.id]: value,
							}));
						}}
						minCount={0}
						disabled={item.optionality === undefined}
					>
						<motion.div
							key={`${item.label} ${item.quantity}x ${item.price} ${bill.currency}`}
							initial={{ scale: 1.1, opacity: 0.5 }}
							animate={{ scale: 1, opacity: 1 }}
							className={"flex flex-col items-start"}
						>
							<strong>{item.label}</strong>
							<small>
								{item.quantity}×&nbsp;&nbsp;•&nbsp;&nbsp;
								{formatMoney({
									value: item.price,
									currency: bill.currency,
								})}
							</small>
							<Collapsible
								open={quantity > 0 && quantityLeft > 0}
								onOpenChange={() => {}}
							>
								<CollapsibleContent>
									<span className={"text-xs text-primary flex gap-2 mt-2"}>
										<TriangleAlertIcon size={14} />{" "}
										{t("client:bill.warning.pcsLeft", { count: quantityLeft })}
									</span>
								</CollapsibleContent>
							</Collapsible>
						</motion.div>
					</CounterCheckbox>
				</div>
			</div>
		</div>
	);
}
