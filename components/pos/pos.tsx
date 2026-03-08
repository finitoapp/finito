import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { type FC, type MouseEvent, useRef, useState } from "react";
import { PosBill } from "@/components/pos/pos-bill";
import { PosBillTabs } from "@/components/pos/pos-bill-tabs";
import { PosItems } from "@/components/pos/pos-items";
import { ResponsiveCard } from "@/components/responsive-card";
import { usePos } from "@/hooks/use-pos";
import type { Id } from "@/lib/evolu/types";
import type { Currency } from "@/lib/shared/types";

export const POS: FC<{
	defaultCurrency: Currency;
}> = (props) => {
	const searchParams = useSearchParams();
	const id = searchParams.get("id") as Id | null;
	const pos = usePos();
	const bill = id !== null ? (pos.bills[id] ?? undefined) : undefined;
	const [flyingButtons, setFlyingButtons] = useState<
		Array<{ id: number; x: number; y: number }>
	>([]);
	const nextId = useRef(0);
	const counterRef = useRef<HTMLDivElement>(null);

	const handleButtonClick = (event: MouseEvent<HTMLDivElement>) => {
		const button = event.currentTarget;
		const buttonRect = button.getBoundingClientRect();
		const counterRect = counterRef.current?.getBoundingClientRect();

		if (counterRect) {
			const id = nextId.current++;

			setFlyingButtons((prev) => [
				...prev,
				{
					id,
					x: buttonRect.left + buttonRect.width / 2,
					y: buttonRect.top + buttonRect.height / 2,
				},
			]);

			// Remove flying button after animation
			setTimeout(() => {
				setFlyingButtons((prev) => prev.filter((btn) => btn.id !== id));
			}, 800);
		}
	};

	return (
		<div className={"flex w-full flex-col"}>
			<div className={"w-full mb-4"}>
				<PosBillTabs defaultCurrency={props.defaultCurrency} />
			</div>
			<div className={"w-full flex flex-col md:flex-row gap-4 relative"}>
				{/* Flying buttons animation */}
				<AnimatePresence>
					{flyingButtons.map((btn) => {
						const counterRect = counterRef.current?.getBoundingClientRect();
						if (!counterRect) return null;

						return (
							<motion.div
								key={btn.id}
								className="fixed z-10 pointer-events-none left-0 top-0"
								initial={{
									x: btn.x,
									y: btn.y,
									scale: 1,
									opacity: 0.3,
								}}
								animate={{
									x: counterRect.left + counterRect.width / 2,
									y: counterRect.top + counterRect.height / 2,
									scale: 0,
									opacity: 0.8,
								}}
								exit={{
									scale: 0,
									opacity: 0,
								}}
								transition={{
									duration: 0.4,
									ease: [0.34, 1.56, 0.64, 1],
								}}
							>
								<ResponsiveCard className="w-36 h-36 shadow-2xl bg-primary"></ResponsiveCard>
							</motion.div>
						);
					})}
				</AnimatePresence>

				<PosItems
					bill={bill}
					billId={id ?? undefined}
					onItemClick={handleButtonClick}
					defaultCurrency={props.defaultCurrency}
				/>
				<PosBill
					ref={counterRef}
					key={id ?? ""}
					bill={bill}
					billId={id ?? undefined}
				/>
			</div>
		</div>
	);
};
