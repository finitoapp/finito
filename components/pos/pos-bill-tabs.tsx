import { useAtom } from "jotai";
import { CircleXIcon, PlusIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FC, useEffect } from "react";
import { posAtom } from "@/atoms/pos";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBill } from "@/hooks/use-bill";
import type { Currency } from "@/lib/types";

export const PosBillTabs: FC<{
	defaultCurrency: Currency;
}> = (props) => {
	const [pos] = useAtom(posAtom);
	const { deleteBill, createBill } = useBill();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");

	useEffect(() => {
		if (id === null || pos.bills[id] === undefined) {
			const firstBillId = Object.keys(pos.bills)[0];
			if (firstBillId !== undefined) {
				router.replace(`/admin/pos?id=${encodeURIComponent(firstBillId)}`);
			} else if (id !== null) {
				router.replace(`/admin/pos`);
			}
		}
	}, [pos, id, router.replace, router]);

	return (
		<Tabs value={id ?? ""}>
			<TabsList>
				{Object.entries(pos.bills).map(([billId, bill]) => (
					<TabsTrigger
						className={"pl-4"}
						key={billId}
						value={billId}
						onClick={() =>
							router.replace(`/admin/pos?id=${encodeURIComponent(billId)}`)
						}
					>
						{bill.table
							? bill.table.name
							: bill.label !== ""
								? bill.label
								: `# ${bill.id}`}
						<Button
							size={"lg"}
							variant={"ghost"}
							onClick={() => {
								deleteBill(billId);
							}}
						>
							<CircleXIcon />
						</Button>
					</TabsTrigger>
				))}

				<Button
					size={"lg"}
					variant={"outline"}
					onClick={() => {
						const billId = createBill({
							defaultCurrency: props.defaultCurrency,
						});
						router.replace(`/admin/pos?id=${encodeURIComponent(billId)}`);
					}}
				>
					<PlusIcon />
					New bill
				</Button>
			</TabsList>
		</Tabs>
	);
};
