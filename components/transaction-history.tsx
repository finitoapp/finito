import { CheckIcon, LoaderCircleIcon, ReceiptIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { formatAmount } from "@/lib/format-utils";
import type { Uuid7 } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	paymentFinishedStorage,
	paymentInitStorage,
} from "@/storages/payment-progress-storage";

const PaymentStatus: FC<{
	paymentId: Uuid7;
}> = (props) => {
	const { data: items, eose } = useStorageSubscription(paymentFinishedStorage, {
		limit: 15,
		key: props.paymentId,
	});

	const item = items && items[0];

	const [className, icon] = (() => {
		if (!item && !eose) {
			return ["", <LoaderCircleIcon key={1} className="animate-spin size-4" />];
		}

		if (item && item.value.type === "success") {
			return ["bg-green-500", <CheckIcon key={1} className="size-4" />];
		}

		return ["bg-red-700", <XIcon key={1} className="size-4" />];
	})();

	return (
		<div
			className={cn(
				"h-6 w-6 rounded-full flex items-center justify-center",
				className,
			)}
		>
			{icon}
		</div>
	);
};

export const TransactionHistory = () => {
	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(paymentInitStorage, {
		limit: 20,
	});

	return (
		<VerticalNav
			title={"Transaction history"}
			items={(items === undefined
				? [null, null, null, null]
				: items.length === 0
					? ([false] as const)
					: items
			).map((item, index) => {
				if (item === false) {
					return {
						disableAction: true,
						label: (
							<div
								className={
									"flex flex-col justify-center items-center gap-8 py-10"
								}
							>
								<ReceiptIcon className="h-10 w-10 text-muted-foreground" />
								<h2 className={"text-foreground text-lg"}>
									Your transaction history is empty
								</h2>
								<p className="text-balance text-sm text-muted-foreground text-center">
									Your payment transactions will appear here once you make your
									first purchase or sale.
								</p>
							</div>
						),
					};
				}

				if (item === null) {
					return {
						className:
							index === 1
								? "opacity-70"
								: index === 2
									? "opacity-50"
									: index === 3
										? "opacity-25"
										: index === 4
											? "opacity-15"
											: undefined,
						label: (
							<div className={cn("flex flex-col gap-2 items-start w-max")}>
								<strong>
									<Skeleton className={"h-5 w-[250px]"} />
								</strong>
								<div className={"flex justify-between w-full text-xs"}>
									<span>
										<Skeleton className={"h-4 w-[20px]"} />
									</span>
									&nbsp;&nbsp;•&nbsp;&nbsp;
									<span className={"text-muted-foreground"}>
										<Skeleton className={"h-4 w-[50px]"} />
									</span>
								</div>
							</div>
						),
						icon: <Skeleton className="h-10 w-10 p-2" />,
					};
				}

				const totalAmount =
					item.value.items.reduce(
						(acc, value) => acc + value.price * value.quantity,
						0,
					) + (item.value.tip ?? 0);

				return {
					label: (
						<div className={"flex flex-col gap-2 items-start w-max"}>
							<strong>{item.value.merchant?.name ?? "Unknown merchant"}</strong>
							<div className={"flex justify-between w-full text-xs"}>
								<span>{formatAmount(totalAmount, item.value.currency)}</span>
								&nbsp;&nbsp;•&nbsp;&nbsp;
								<span className={"text-muted-foreground"}>
									{new Date(item.createdAt * 1000).toLocaleString()}
								</span>
							</div>
						</div>
					),
					icon: (
						<div className={"p-2"}>
							<PaymentStatus paymentId={item.value.paymentId} />
						</div>
					),
					nextLink: `/history/detail?id=${encodeURIComponent(item.key ?? "")}`,
				};
			})}
		/>
	);
};
