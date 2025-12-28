"use client";

import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { PaymentStatusBadge } from "@/app/admin/(private)/payments/payment-status-badge";
import { DataGrid } from "@/components/data-grid";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardHeading,
	CardTitle,
	CardToolbar,
} from "@/components/ui/card";
import { useNostrSubscription } from "@/hooks/use-nostr-subscription";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { formatAmount } from "@/lib/format-utils";
import { type Payment, paymentStorage } from "@/storages/payment-storage";

export function PaymentsTable() {
	const router = useRouter();
	const [paymentPubkeys, setPaymentPubkeys] = useState<{
		pubkeys: string[];
		authors: string[];
	} | null>(null);

	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(paymentStorage, {
		limit: 15,
	});

	const paymentStatusRef = useRef<Record<string, true>>({});
	useNostrSubscription(
		paymentPubkeys !== null
			? {
					kinds: [9735], // zap receipt
					authors: paymentPubkeys.authors,
					"#p": paymentPubkeys.pubkeys,
					limit: 20,
				}
			: false,
		{
			transform: async (event) => {
				const p = event.tags.find((tag) => tag[0] === "p");
				if (p === undefined) {
					return undefined;
				}
				const pubkey = p[1];

				paymentStatusRef.current[pubkey] = true;
				return event;
			},
		},
	);

	const findLnZapPaymentOption = (paymentOptions: Payment["paymentOptions"]) =>
		paymentOptions.find((paymentOption) => paymentOption.type === "lnZap");

	const computePaymentPubkeys = useEffectEvent(() => {
		const pubkeys: string[] = [];
		const authors: string[] = [];

		for (const payment of items ?? []) {
			const paymentOption = findLnZapPaymentOption(
				payment.value.paymentOptions,
			);
			if (paymentOption === undefined) {
				continue;
			}

			const ndkSigner = new NDKPrivateKeySigner(payment.value.privateKey);

			pubkeys.push(ndkSigner.pubkey);
			authors.push(paymentOption.walletPubkey);
		}

		setPaymentPubkeys({
			pubkeys,
			authors,
		});
	});

	useEffect(() => {
		if (!eose) {
			return;
		}

		computePaymentPubkeys();
	}, [eose]);

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>Payment Messages</CardTitle>
					<CardDescription>
						Decrypted payment data from Nostr NIP-04 direct messages
					</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/payments/new"}>
						<Button>
							<PlusIcon />
							New payment
						</Button>
					</Link>
				</CardToolbar>
			</CardHeader>
			<CardContent className={"p-0"}>
				<DataGrid
					data={
						items
							? items.map((payment) => {
									const ndkSigner = new NDKPrivateKeySigner(
										payment.value.privateKey,
									);

									const paymentOption = findLnZapPaymentOption(
										payment.value.paymentOptions,
									);

									return {
										id: payment.value.id,
										createdAt: new Date(payment.createdAt * 1000),
										amount: formatAmount(
											payment.value.bill.items.reduce(
												(acc, val) => acc + val.price,
												0,
											),
											payment.value.bill.currency,
										),
										status:
											paymentOption !== undefined
												? paymentStatusRef.current[ndkSigner.pubkey]
													? "Paid"
													: paymentOption.expirationIn < Date.now() / 1000
														? "Expired"
														: "Waiting"
												: "Unknown",
										label: payment.value.bill.items[0].label,
									};
								})
							: undefined
					}
					columns={[
						{
							key: "createdAt" as const,
							header: "Created at",
							width: "200px",
							render: (value) => value.toLocaleString(),
						},
						{
							key: "amount" as const,
							header: "Amount",
							width: "200px",
						},
						{
							key: "status" as const,
							header: "Status",
							width: "250px",
							render: (_, row) => <PaymentStatusBadge paymentId={row.id} />,
						},
						{
							key: "label" as const,
							header: "Description",
						},
					]}
					onRowClick={(payment) =>
						router.push(
							`/admin/payments/detail?id=${encodeURIComponent(payment.id)}`,
						)
					}
					className="border rounded-md"
				/>

				{hasNextPage && (
					<div className={"flex my-4 justify-center"}>
						<Button
							disabled={!eose}
							variant={"outline"}
							size={"sm"}
							onClick={loadNextPage}
						>
							Load next page
						</Button>
					</div>
				)}
			</CardContent>
		</ResponsiveCard>
	);
}
