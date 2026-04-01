"use client";

import type { Id } from "@evolu/common";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { Integer } from "@/lib/shared/types";
import { formatDateTime, formatMoney } from "@/lib/shared/utils/format";
import { createItemDetailQuery } from "../item-detail-query";
import { createItemSalesQuery } from "./item-analytics-query";

const LAST_DAYS = 30;

const quantityFormatter = new Intl.NumberFormat(undefined, {
	maximumFractionDigits: 2,
});

const toDateKey = (date: Date) =>
	`${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

const toDateLabel = (date: Date) =>
	date.toLocaleDateString(undefined, {
		month: "2-digit",
		day: "2-digit",
	});

type DailyBucket = {
	dateKey: string;
	dateLabel: string;
	orders: number;
	units: number;
	revenue: number;
	orderIds: Set<string>;
};

const createDailyBuckets = () => {
	const startDate = new Date();
	startDate.setHours(0, 0, 0, 0);
	startDate.setDate(startDate.getDate() - (LAST_DAYS - 1));

	const buckets: DailyBucket[] = [];
	const bucketMap = new Map<string, DailyBucket>();

	for (let index = 0; index < LAST_DAYS; index += 1) {
		const date = new Date(startDate);
		date.setDate(startDate.getDate() + index);

		const bucket: DailyBucket = {
			dateKey: toDateKey(date),
			dateLabel: toDateLabel(date),
			orders: 0,
			units: 0,
			revenue: 0,
			orderIds: new Set<string>(),
		};

		bucketMap.set(bucket.dateKey, bucket);
		buckets.push(bucket);
	}

	return { startDate, buckets, bucketMap };
};

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const itemId = searchParams.get("id");

	if (itemId === null) {
		throw Promise.reject();
	}

	const itemDetailQuery = useMemo(
		() => createItemDetailQuery(itemId as Id),
		[itemId],
	);
	const salesQuery = useMemo(
		() => createItemSalesQuery(itemId as Id),
		[itemId],
	);

	const { data: itemRows } = useEvoluQuery(itemDetailQuery);
	const { data: salesRows } = useEvoluQuery(salesQuery);
	const item = itemRows[0];

	const salesChartConfig = {
		orders: {
			label: t("items:detail.analytics.legend.orders"),
			color: "var(--color-chart-1)",
		},
		units: {
			label: t("items:detail.analytics.legend.units"),
			color: "var(--color-chart-2)",
		},
	} satisfies ChartConfig;

	const revenueChartConfig = {
		revenue: {
			label: t("items:detail.analytics.legend.revenue"),
			color: "var(--color-chart-3)",
		},
	} satisfies ChartConfig;

	const analytics = useMemo(() => {
		const { startDate, buckets, bucketMap } = createDailyBuckets();

		let totalUnits = 0;
		let totalRevenue = 0;
		const orderIds = new Set<string>();
		const currencyMatchedOrderIds = new Set<string>();
		let lastSoldAt: Date | null = null;

		for (const row of salesRows) {
			const soldAt = new Date(row.createdAt);
			if (Number.isNaN(soldAt.getTime())) {
				continue;
			}

			const paymentId = row.paymentId.toString();
			orderIds.add(paymentId);
			totalUnits += row.quantity;

			if (item && row.currency === item.currency) {
				totalRevenue += row.totalAmount;
				currencyMatchedOrderIds.add(paymentId);
			}

			if (lastSoldAt === null || soldAt > lastSoldAt) {
				lastSoldAt = soldAt;
			}

			if (soldAt < startDate) {
				continue;
			}

			const bucket = bucketMap.get(toDateKey(soldAt));
			if (!bucket) {
				continue;
			}

			bucket.units += row.quantity;
			if (item && row.currency === item.currency) {
				bucket.revenue += row.totalAmount;
			}

			if (!bucket.orderIds.has(paymentId)) {
				bucket.orderIds.add(paymentId);
				bucket.orders += 1;
			}
		}

		const dailyData = buckets.map((bucket) => ({
			dateKey: bucket.dateKey,
			dateLabel: bucket.dateLabel,
			orders: bucket.orders,
			units: bucket.units,
			revenue: bucket.revenue,
		}));

		const averageOrderValue =
			currencyMatchedOrderIds.size > 0
				? Math.round(totalRevenue / currencyMatchedOrderIds.size)
				: null;

		return {
			totalOrders: orderIds.size,
			totalUnits,
			totalRevenue,
			averageOrderValue,
			lastSoldAt,
			dailyData,
		};
	}, [salesRows, item]);

	if (!item) {
		return null;
	}

	const hasSales = analytics.totalOrders > 0;

	return (
		<div className="w-full lg:max-w-7xl">
			<div className="grid gap-4">
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<Card size="sm">
						<CardHeader>
							<CardDescription>
								{t("items:detail.analytics.cards.orders")}
							</CardDescription>
							<CardTitle className="text-2xl">
								{analytics.totalOrders.toLocaleString()}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card size="sm">
						<CardHeader>
							<CardDescription>
								{t("items:detail.analytics.cards.units")}
							</CardDescription>
							<CardTitle className="text-2xl">
								{quantityFormatter.format(analytics.totalUnits)}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card size="sm">
						<CardHeader>
							<CardDescription>
								{t("items:detail.analytics.cards.revenue")}
							</CardDescription>
							<CardTitle className="text-2xl">
								{formatMoney({
									value: Integer(analytics.totalRevenue),
									currency: item.currency,
								})}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card size="sm">
						<CardHeader>
							<CardDescription>
								{t("items:detail.analytics.cards.averageOrder")}
							</CardDescription>
							<CardTitle className="text-2xl">
								{analytics.averageOrderValue === null
									? "-"
									: formatMoney({
											value: Integer(analytics.averageOrderValue),
											currency: item.currency,
										})}
							</CardTitle>
						</CardHeader>
					</Card>
				</div>

				<Card size="sm">
					<CardHeader>
						<CardDescription>
							{t("items:detail.analytics.cards.lastSale")}
						</CardDescription>
						<CardTitle>
							{analytics.lastSoldAt
								? formatDateTime(analytics.lastSoldAt)
								: t("items:detail.analytics.empty.noSales")}
						</CardTitle>
					</CardHeader>
				</Card>

				{!hasSales ? (
					<Card>
						<CardHeader>
							<CardTitle>{t("items:detail.analytics.empty.title")}</CardTitle>
							<CardDescription>
								{t("items:detail.analytics.empty.description")}
							</CardDescription>
						</CardHeader>
					</Card>
				) : (
					<div className="grid gap-4 xl:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>
									{t("items:detail.analytics.charts.salesTrend.title")}
								</CardTitle>
								<CardDescription>
									{t("items:detail.analytics.charts.salesTrend.description", {
										days: LAST_DAYS,
									})}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ChartContainer
									config={salesChartConfig}
									className="h-72 w-full"
								>
									<LineChart data={analytics.dailyData}>
										<CartesianGrid vertical={false} />
										<XAxis
											dataKey="dateLabel"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
											minTickGap={28}
										/>
										<YAxis
											tickLine={false}
											axisLine={false}
											tickMargin={8}
											allowDecimals={false}
											width={30}
										/>
										<ChartTooltip content={<ChartTooltipContent />} />
										<ChartLegend content={<ChartLegendContent />} />
										<Line
											dataKey="orders"
											type="monotone"
											stroke="var(--color-orders)"
											strokeWidth={2}
											dot={false}
										/>
										<Line
											dataKey="units"
											type="monotone"
											stroke="var(--color-units)"
											strokeWidth={2}
											dot={false}
										/>
									</LineChart>
								</ChartContainer>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>
									{t("items:detail.analytics.charts.revenueTrend.title")}
								</CardTitle>
								<CardDescription>
									{t("items:detail.analytics.charts.revenueTrend.description", {
										days: LAST_DAYS,
									})}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ChartContainer
									config={revenueChartConfig}
									className="h-72 w-full"
								>
									<BarChart data={analytics.dailyData}>
										<CartesianGrid vertical={false} />
										<XAxis
											dataKey="dateLabel"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
											minTickGap={28}
										/>
										<YAxis hide />
										<ChartTooltip
											content={
												<ChartTooltipContent
													formatter={(value, _name) => (
														<div className="flex flex-1 items-center justify-between gap-2 leading-none">
															<span className="text-muted-foreground">
																{revenueChartConfig.revenue.label}
															</span>
															<span className="font-mono font-medium tabular-nums text-foreground">
																{formatMoney({
																	value: Integer(Number(value ?? 0)),
																	currency: item.currency,
																})}
															</span>
														</div>
													)}
												/>
											}
										/>
										<Bar
											dataKey="revenue"
											fill="var(--color-revenue)"
											radius={[4, 4, 0, 0]}
										/>
									</BarChart>
								</ChartContainer>
							</CardContent>
						</Card>
					</div>
				)}
			</div>
		</div>
	);
}
