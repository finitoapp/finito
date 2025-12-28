"use client";

import {
	IconCashRegister,
	IconFileInvoice,
	IconListDetails,
	IconPackage,
} from "@tabler/icons-react";
import { CalendarIcon, ConstructionIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ClickableCard } from "@/components/clickable-card";
import { FinitoLogo } from "@/components/finito-logo";
import { ResponsiveCard } from "@/components/responsive-card";
import { Badge } from "@/components/ui/badge";
import {
	CardContent,
	CardHeader,
	CardTitle,
	CardToolbar,
} from "@/components/ui/card";

export default function Home() {
	const router = useRouter();

	return (
		<div className="text-center mb-8 w-full lg:max-w-7xl">
			<div className={"py-8"}>
				<h1 className="text-3xl font-bold mb-4">
					<div className={"flex justify-center"}>
						<FinitoLogo />
					</div>
				</h1>
				<p className="text-muted-foreground" data-testid="text">
					Decentralized payment platform and point of sale system
				</p>
			</div>

			<div className={"w-full flex gap-8 mt-8 flex-wrap justify-center"}>
				<ClickableCard
					title={"Payments"}
					description={
						"Create one-time payments that can be made without having to be online."
					}
					onClick={() => router.push("/admin/payments")}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<IconListDetails size={64} />
					</div>
				</ClickableCard>

				<ClickableCard
					title={"Point of sale system"}
					description={`
					Keep track of open bills and process payments. This is a robust
					solution for small shops, bistros, cafes, etc.
					`}
					onClick={() => router.push("/admin/pos")}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<IconCashRegister size={64} />
					</div>
				</ClickableCard>

				<ClickableCard
					title={"Invoicing"}
					description={
						"Issue invoices to your customers conveniently and yet securely. Leave no trace of yourself or your customers on public clouds."
					}
					onClick={() => router.push("/admin/invoices")}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<IconFileInvoice size={64} />
					</div>
				</ClickableCard>

				<ClickableCard
					title={"Item management"}
					data-testid="items"
					description={
						"Don't waste time entering items over and over again while creating" +
						" payments. Specify your sales items in advance."
					}
					onClick={() => router.push("/admin/items")}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<IconPackage size={64} />
					</div>
				</ClickableCard>

				<ResponsiveCard className="@container/card min-w-sm">
					<CardHeader
						className={"flex flex-col items-center justify-center py-8 gap-8"}
					>
						<CardTitle>Order payments</CardTitle>
						<CardToolbar>
							<Badge>
								<ConstructionIcon />
								under development
							</Badge>
						</CardToolbar>
					</CardHeader>
					<CardContent>
						<p className={"text-muted-foreground text-sm"}>
							Accept money from customers based on their selection of items.
							It's an ideal solution for sales stands.
						</p>
					</CardContent>
				</ResponsiveCard>

				<ResponsiveCard className="@container/card min-w-sm">
					<CardHeader
						className={"flex flex-col items-center justify-center py-8 gap-8"}
					>
						<CardTitle>Payment widgets & Paywalls</CardTitle>
						<CardToolbar>
							<Badge variant={"secondary"}>
								<CalendarIcon />
								planned
							</Badge>
						</CardToolbar>
					</CardHeader>
					<CardContent>
						<p className={"text-muted-foreground text-sm"}>
							Integrate payment elements directly into your website. It can be
							both payment buttons and locked sections hidden behind a payment
							wall.
						</p>
					</CardContent>
				</ResponsiveCard>

				<ResponsiveCard className="@container/card min-w-sm">
					<CardHeader
						className={"flex flex-col items-center justify-center py-8 gap-8"}
					>
						<CardTitle>Reservations</CardTitle>
						<CardToolbar>
							<Badge variant={"secondary"}>
								<CalendarIcon />
								planned
							</Badge>
						</CardToolbar>
					</CardHeader>
					<CardContent>
						<p className={"text-muted-foreground text-sm"}>
							Utilize the full capacity of your venue. Offer your customers the
							option of booking a place either online or by phone.
						</p>
					</CardContent>
				</ResponsiveCard>
			</div>
		</div>
	);
}
