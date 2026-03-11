"use client";

import {
	IconCashRegister,
	IconFileInvoice,
	IconListDetails,
	IconPackage,
} from "@tabler/icons-react";
import {
	CalendarClockIcon,
	CalendarIcon,
	ConstructionIcon,
	UtensilsCrossedIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ClickableCard } from "@/components/clickable-card";
import { FinitoLogo } from "@/components/finito-logo";
import { ResponsiveCard } from "@/components/responsive-card";
import { Badge } from "@/components/ui/badge";
import {
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function Home() {
	const { t } = useTranslation();
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
					{t("admin:dashboard.home.subtitle")}
				</p>
			</div>

			<div className={"w-full flex gap-8 mt-8 flex-wrap justify-center"}>
				<ClickableCard
					title={t("admin:dashboard.home.cards.payments.title")}
					description={t("admin:dashboard.home.cards.payments.description")}
					onClick={() => router.push("/admin/payments")}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<IconListDetails size={64} />
					</div>
				</ClickableCard>

				<ClickableCard
					title={t("admin:dashboard.home.cards.pos.title")}
					description={t("admin:dashboard.home.cards.pos.description")}
					onClick={() => router.push("/admin/pos")}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<IconCashRegister size={64} />
					</div>
				</ClickableCard>

				<ClickableCard
					title={t("admin:dashboard.home.cards.invoicing.title")}
					description={t("admin:dashboard.home.cards.invoicing.description")}
					onClick={() => router.push("/admin/invoices")}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<IconFileInvoice size={64} />
					</div>
				</ClickableCard>

				<ClickableCard
					title={t("admin:dashboard.home.cards.itemManagement.title")}
					data-testid="items"
					description={t(
						"admin:dashboard.home.cards.itemManagement.description",
					)}
					onClick={() => router.push("/admin/items")}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<IconPackage size={64} />
					</div>
				</ClickableCard>

				<ClickableCard
					title={t("admin:dashboard.home.cards.menuManagement.title")}
					description={t(
						"admin:dashboard.home.cards.menuManagement.description",
					)}
					onClick={() => router.push("/admin/menus" as never)}
					className={"@container/card min-w-sm"}
				>
					<div className={"w-full flex justify-center"}>
						<UtensilsCrossedIcon size={64} />
					</div>
				</ClickableCard>

				<ResponsiveCard className="@container/card min-w-sm">
					<CardHeader
						className={"flex flex-col items-center justify-center py-8 gap-8"}
					>
						<CardTitle>{t("admin:dashboard.orderPayments")}</CardTitle>
						<CardAction>
							<Badge>
								<ConstructionIcon />
								{t("admin:dashboard.home.status.underDevelopment")}
							</Badge>
						</CardAction>
					</CardHeader>
					<CardContent>
						<p className={"text-muted-foreground text-sm"}>
							{t("admin:dashboard.home.cards.orderPayments.description")}
						</p>
					</CardContent>
				</ResponsiveCard>

				<ResponsiveCard className="@container/card min-w-sm">
					<CardHeader
						className={"flex flex-col items-center justify-center py-8 gap-8"}
					>
						<CardTitle>{t("admin:dashboard.paymentWidgetsPaywalls")}</CardTitle>
						<CardAction>
							<Badge variant={"secondary"}>
								<CalendarIcon />
								{t("admin:dashboard.home.status.planned")}
							</Badge>
						</CardAction>
					</CardHeader>
					<CardContent>
						<p className={"text-muted-foreground text-sm"}>
							{t(
								"admin:dashboard.home.cards.paymentWidgetsPaywalls.description",
							)}
						</p>
					</CardContent>
				</ResponsiveCard>

				<ResponsiveCard className="@container/card min-w-sm">
					<CardHeader
						className={"flex flex-col items-center justify-center py-8 gap-8"}
					>
						<CardTitle>{t("admin:dashboard.reservations")}</CardTitle>
						<CardAction>
							<Badge
								variant={"secondary"}
								aria-label={t("admin:dashboard.reservations")}
							>
								<CalendarClockIcon />
							</Badge>
						</CardAction>
					</CardHeader>
					<CardContent>
						<p className={"text-muted-foreground text-sm"}>
							{t("admin:dashboard.home.cards.reservations.description")}
						</p>
					</CardContent>
				</ResponsiveCard>
			</div>
		</div>
	);
}
