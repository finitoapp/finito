"use client";

import type { Id } from "@evolu/common";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { formatDateTime, formatMoney } from "@/lib/shared/utils/format";
import { createBillDetailQuery } from "../bill-detail-query";

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");

	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(() => createBillDetailQuery(id as Id), [id]);

	const { data: bills } = useEvoluQuery(query);
	const bill = bills[0];

	if (bill === undefined) {
		return null;
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_22rem]">
			<div className="flex min-w-0 flex-col gap-4">
				<ResponsiveCard>
					<CardContent className="pt-6">
						<div className="flex flex-col gap-8">
							<div className="flex flex-wrap gap-4">
								<StaticCard
									title={t("bills:detail.stats.total")}
									content={formatMoney({
										value: bill.totalAmount,
										currency: bill.currency,
									})}
									className="flex-1 min-w-40"
								/>
								<StaticCard
									title={t("bills:detail.stats.currency")}
									content={bill.currency}
									className="flex-1 min-w-40"
								/>
								<StaticCard
									title={t("bills:detail.stats.items")}
									content={bill.items.length.toString()}
									className="flex-1 min-w-40"
								/>
							</div>

							<div className="flex flex-wrap gap-8">
								<div className="min-w-72 flex-1">
									<KeyValueList
										items={[
											{
												key: t("bills:detail.fields.bill"),
												value: `#${bill.displayId}`,
											},
											{
												key: t("bills:detail.fields.label"),
												value: bill.label ?? "-",
											},
											{
												key: t("bills:detail.fields.table"),
												value:
													bill.tableLabel && bill.tableId ? (
														<Link
															href={
																`/admin/venue/tables/detail?id=${encodeURIComponent(bill.tableId)}` as never
															}
															className="text-primary hover:underline"
														>
															{bill.tableLabel}
														</Link>
													) : (
														"-"
													),
											},
											{
												key: t("bills:detail.fields.device"),
												value:
													bill.deviceName && bill.deviceId ? (
														<Link
															href={
																`/admin/settings/devices/detail?id=${encodeURIComponent(bill.deviceId)}` as never
															}
															className="text-primary hover:underline"
														>
															{bill.deviceName}
														</Link>
													) : (
														"-"
													),
											},
											{
												key: t("bills:detail.fields.createdAt"),
												value: formatDateTime(new Date(bill.createdAt)),
											},
										]}
									/>
								</div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>

				<ResponsiveCard>
					<CardHeader>
						<CardTitle>{t("bills:detail.sections.items")}</CardTitle>
					</CardHeader>
					<CardContent className="px-0">
						{bill.items.length === 0 ? (
							<div className="px-6 py-4 text-sm text-muted-foreground">
								{t("bills:detail.empty.items")}
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="px-6">
											{t("bills:detail.items.columns.item")}
										</TableHead>
										<TableHead>
											{t("bills:detail.items.columns.quantity")}
										</TableHead>
										<TableHead className="px-6 text-right">
											{t("bills:detail.items.columns.total")}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{bill.items.map((item) => (
										<TableRow key={item.itemId}>
											<TableCell className="px-6 whitespace-normal">
												{item.catalogItemId ? (
													<Link
														href={
															`/admin/catalog/detail?id=${encodeURIComponent(item.catalogItemId)}` as never
														}
														className="text-primary hover:underline"
													>
														{item.label}
													</Link>
												) : (
													item.label
												)}
											</TableCell>
											<TableCell>{item.quantity.toLocaleString()}</TableCell>
											<TableCell className="px-6 text-right">
												{formatMoney({
													value: item.totalAmount,
													currency: bill.currency,
												})}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</ResponsiveCard>

				{bill.rates.length > 0 && (
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>{t("bills:detail.sections.exchangeRates")}</CardTitle>
						</CardHeader>
						<CardContent className="px-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="px-6">
											{t("bills:detail.rates.columns.currency")}
										</TableHead>
										<TableHead className="px-6 text-right">
											{t("bills:detail.rates.columns.rate")}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{bill.rates.map((rate) => (
										<TableRow key={rate.currency}>
											<TableCell className="px-6">{rate.currency}</TableCell>
											<TableCell className="px-6 text-right">
												{rate.rate.toLocaleString()}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</ResponsiveCard>
				)}
			</div>

			<div className="min-w-72 flex flex-col gap-4">
				<ResponsiveCard>
					<CardHeader>
						<CardTitle>{t("common:table.actions")}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<Button
							variant="outline"
							className="w-full"
							nativeButton={false}
							render={
								<Link
									href={`/admin/pos?id=${encodeURIComponent(bill.id)}` as never}
								/>
							}
						>
							<ExternalLink />
							{t("bills:detail.actions.openInPos")}
						</Button>
						{bill.tableId && (
							<Button
								variant="outline"
								className="w-full"
								nativeButton={false}
								render={
									<Link
										href={
											`/admin/venue/tables/detail?id=${encodeURIComponent(bill.tableId)}` as never
										}
									/>
								}
							>
								<ExternalLink />
								{t("bills:detail.actions.openTable")}
							</Button>
						)}
					</CardContent>
				</ResponsiveCard>
			</div>
		</div>
	);
}
