import { CircleXIcon, PlusIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBill } from "@/hooks/use-bill";
import { usePos } from "@/hooks/use-pos";
import type { Id } from "@/lib/evolu/types";
import type { Currency } from "@/lib/shared/types";

export const PosBillTabs: FC<{
	defaultCurrency: Currency;
}> = (props) => {
	const { t } = useTranslation();
	const pos = usePos();
	const { deleteBill, createBill } = useBill();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const variant = searchParams.get("variant");

	useEffect(() => {
		if (id === null || pos.bills[id as Id] === undefined) {
			const firstBillId = Object.keys(pos.bills)[0];
			if (firstBillId !== undefined) {
				router.replace(
					`/admin/pos?id=${encodeURIComponent(firstBillId)}${variant ? `&variant=${encodeURIComponent(variant)}` : ""}`,
				);
			} else if (id !== null) {
				router.replace(
					`/admin/pos?${variant ? `variant=${encodeURIComponent(variant)}` : ""}`,
				);
			}
		}
	}, [pos, id, router.replace, router, variant]);

	return (
		<Tabs value={id ?? ""}>
			{Object.entries(pos.bills).length > 0 && (
				<TabsList>
					{Object.entries(pos.bills).map(([billId, bill]) => (
						<TabsTrigger
							className={"pl-4"}
							key={billId}
							value={billId}
							onClick={() =>
								router.replace(
									`/admin/pos?id=${encodeURIComponent(billId)}${variant ? `&variant=${encodeURIComponent(variant)}` : ""}`,
								)
							}
						>
							{bill.table
								? bill.table.label
								: bill.label
									? bill.label
									: `# ${bill.id}`}
							<Button
								size={"xs"}
								variant={"ghost"}
								onClick={() => {
									deleteBill(billId as Id);
								}}
							>
								<CircleXIcon />
							</Button>
						</TabsTrigger>
					))}
				</TabsList>
			)}
			<Button
				size={"lg"}
				variant={"outline"}
				onClick={() => {
					const { id: billId } = createBill({
						defaultCurrency: props.defaultCurrency,
					});
					router.replace(`/admin/pos?id=${encodeURIComponent(billId)}`);
				}}
			>
				<PlusIcon />
				{t("pos:tabs.newBill")}
			</Button>
		</Tabs>
	);
};
