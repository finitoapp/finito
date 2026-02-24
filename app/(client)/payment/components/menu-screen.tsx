import type { FC } from "react";
import { useTranslation } from "react-i18next";
import type { ScreenData } from "@/lib/bill/driver";
import { formatMoney } from "@/lib/shared/utils/format";

export const MenuScreen: FC<{
	screen: Extract<
		ScreenData,
		{
			variant: "menu";
		}
	>;
}> = (props) => {
	const { i18n, t } = useTranslation();
	const timezone = props.screen.payload.timezone;
	const formatDate = (timestamp: number) =>
		new Intl.DateTimeFormat(i18n.language, {
			dateStyle: "medium",
			timeZone: timezone,
		}).format(new Date(timestamp));
	const formatTime = (timestamp: number) =>
		new Intl.DateTimeFormat(i18n.language, {
			timeStyle: "short",
			timeZone: timezone,
		}).format(new Date(timestamp));
	const formatDateTime = (timestamp: number) =>
		new Intl.DateTimeFormat(i18n.language, {
			dateStyle: "medium",
			timeStyle: "short",
			timeZone: timezone,
		}).format(new Date(timestamp));
	const getDayKey = (timestamp: number) =>
		new Intl.DateTimeFormat(i18n.language, {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			timeZone: timezone,
		}).format(new Date(timestamp));
	const formatValidity = (
		validFrom: number | undefined,
		validTo: number | undefined,
	): string | null => {
		if (validFrom === undefined && validTo === undefined) return null;
		if (validFrom !== undefined && validTo !== undefined) {
			if (getDayKey(validFrom) === getDayKey(validTo)) {
				return t("client:paymentPage.menu.validity.sameDay", {
					date: formatDate(validFrom),
					from: formatTime(validFrom),
					to: formatTime(validTo),
				});
			}
			return t("client:paymentPage.menu.validity.fromTo", {
				from: formatDateTime(validFrom),
				to: formatDateTime(validTo),
			});
		}
		if (validFrom !== undefined) {
			return t("client:paymentPage.menu.validity.from", {
				from: formatDateTime(validFrom),
			});
		}
		return t("client:paymentPage.menu.validity.to", {
			to: formatDateTime(validTo!),
		});
	};

	return (
		<div className="mb-28 flex flex-col grow px-4">
			<div className="flex flex-col gap-6">
				{props.screen.payload.menus.map((menu) => (
					<section
						key={menu.id}
						className="rounded-xl border bg-card p-4 shadow-sm"
					>
						<div className="mb-4 border-b pb-3">
							<h2 className="text-xl font-semibold tracking-tight leading-tight text-foreground">
								{menu.name}
							</h2>
							{formatValidity(menu.validFrom, menu.validTo) && (
								<div className="mt-2 text-xs text-muted-foreground">
									{formatValidity(menu.validFrom, menu.validTo)}
								</div>
							)}
						</div>

						<div className="flex flex-col gap-4">
							{menu.categories.map((category) => (
								<div key={category.id} className="flex flex-col gap-2">
									<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em]">
										{category.name}
									</h3>
									<div className="flex flex-col gap-2">
										{category.items.map((item) => (
											<div
												key={item.id}
												className="flex items-start justify-between gap-4 rounded-lg px-1 py-1"
											>
												<div className="min-w-0">
													<div
														className={[
															"text-sm font-medium leading-snug",
															item.isSoldOut
																? "text-muted-foreground line-through"
																: "text-foreground",
														].join(" ")}
													>
														{item.label}
													</div>
													{item.unitOfMeasure && (
														<div
															className={[
																"text-xs leading-tight text-muted-foreground",
																item.isSoldOut ? "line-through opacity-80" : "",
															].join(" ")}
														>
															{item.unitOfMeasure}
														</div>
													)}
												</div>
												<div
													className={[
														"shrink-0 text-sm font-semibold tabular-nums",
														item.isSoldOut
															? "text-muted-foreground line-through"
															: "text-foreground",
													].join(" ")}
												>
													{formatMoney({
														value: item.priceValue,
														currency: item.priceCurrency,
													})}
												</div>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					</section>
				))}

				<div className="rounded-xl border bg-muted/30 px-4 py-3">
					<div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						{t("client:paymentPage.menu.generatedAt")}
					</div>
					<div className="mt-1 text-sm font-medium leading-tight text-foreground">
						{formatDateTime(props.screen.payload.generatedAt)}
					</div>
					<div className="mt-0.5 text-xs text-muted-foreground">{timezone}</div>
				</div>
			</div>
		</div>
	);
};
