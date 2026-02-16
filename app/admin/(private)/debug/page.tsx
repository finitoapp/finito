"use client";

import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { faker } from "@faker-js/faker";
import { IconDownload, IconReload, IconUpload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { LoaderCircleIcon } from "lucide-react";
import {
	type ChangeEvent,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { FullscreenContainer } from "@/components/fullscreen-container";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";
import { useNostrRelays } from "@/hooks/use-nostr-relays";
import { decodeCsv, encodeCsv } from "@/lib/csv";
import { Schema } from "@/lib/evolu";
import { downloadFile } from "@/lib/file-utils";
import { Currency } from "@/lib/types";
import { createZip, extractZip } from "@/lib/zip";
import { MenuStatus } from "@/storages/menu-storage";

const DownloadSqliteData = () => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [isLoading, setLoading] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);

	const handleDownload = async () => {
		setLoading(true);

		try {
			const result = await evolu.exportDatabase();

			downloadFile({
				bytes: [new Blob([result])],
				mimetype: "application/x-sqlite3",
				fileName: "finito-export.sqlite",
			});
		} finally {
			setLoading(false);
		}
	};

	const fetchDatabaseFile = useEffectEvent(async () => {
		try {
			const result = await evolu.exportDatabase();
			return new Uint8Array(result); // Convert to Uint8Array
		} catch (error) {
			console.error("Error fetching the database file:", error);
			return null;
		}
	});

	const dbSentRef = useRef(false);
	useEffect(() => {
		if (iframeRef.current === null) {
			return;
		}

		const iframe = iframeRef.current;

		window.addEventListener("message", async (event) => {
			if (event.origin !== "https://vwh.github.io") return;

			if (event.data.type === "loadDatabaseBufferReady") {
				if (dbSentRef.current) {
					return;
				}

				dbSentRef.current = true;

				const win = iframe.contentWindow;
				if (win === null) {
					return;
				}

				// Fetch the static database file from the same host
				const databaseFileBytes = await fetchDatabaseFile();

				if (databaseFileBytes) {
					console.log("Sending data to the iframe");
					// Sending the database file bytes to the iframe
					win.postMessage(
						{
							type: "invokeLoadDatabaseBuffer",
							buffer: databaseFileBytes, // Send Uint8Array to iframe
						},
						"https://vwh.github.io/sqlite-online/",
					);
				} else {
					console.error("Failed to load the database file");
				}
			}

			if (event.data.type === "loadDatabaseBytesSuccess") {
				console.log("Successfully loaded database bytes in the iframe");
			}

			if (event.data.type === "loadDatabaseBytesError") {
				console.error(
					"Failed to load database bytes in the iframe:",
					event.data.error,
				);
			}
		});
	}, []);

	return (
		<div className={"space-y-4"}>
			<FullscreenContainer className={"h-200"}>
				<iframe
					title={t("admin:debug.sqlite.explorerTitle")}
					ref={iframeRef}
					src="https://vwh.github.io/sqlite-online/"
					style={{
						width: "100%",
						height: "100%",
					}}
				></iframe>
			</FullscreenContainer>
			<Button type="button" onClick={handleDownload}>
				{isLoading ? (
					<LoaderCircleIcon className="animate-spin" />
				) : (
					<IconDownload />
				)}
				{t("admin:debug.common.download")}
			</Button>
		</div>
	);
};

const DownloadStorageData = () => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [isLoading, setLoading] = useState(false);

	const handleDownload = async () => {
		setLoading(true);

		try {
			const tableNames = Object.keys(Schema).sort();
			const files: Array<{ name: string; data: Uint8Array }> = [];

			for (const tableName of tableNames) {
				const rows = await evolu.loadQuery(
					evolu.createQuery((db) =>
						(db.selectFrom(tableName as never) as never).selectAll(),
					),
				);
				files.push({
					name: `${tableName}.csv`,
					data: encodeCsv(rows as Array<Record<string, unknown>>),
				});
			}

			const zipBytes = createZip(files);

			downloadFile({
				bytes: [new Blob([zipBytes])],
				mimetype: "application/zip",
				fileName: `finito-backup-${format(new Date(), "yyyy-MM-dd_HH:mm:ss")}.zip`,
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button type="button" onClick={handleDownload}>
			{isLoading ? (
				<LoaderCircleIcon className="animate-spin" />
			) : (
				<IconDownload />
			)}
			{t("admin:debug.common.download")}
		</Button>
	);
};

const UploadStorageData = () => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [isLoading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const batchSize = 100;

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file === undefined) {
			return;
		}

		setLoading(true);
		setMessage(null);

		try {
			const zipBytes = new Uint8Array(await file.arrayBuffer());
			const files = extractZip(zipBytes)
				.filter((entry) => entry.name.endsWith(".csv"))
				.sort((a, b) => a.name.localeCompare(b.name));

			if (files.length === 0) {
				throw new Error(t("admin:debug.storage.import.noCsvInArchive"));
			}

			const knownTables = new Set(Object.keys(Schema));
			let importedRows = 0;
			let importedTables = 0;

			for (const entry of files) {
				const tableName = entry.name.replace(/\.csv$/u, "");
				if (!knownTables.has(tableName)) {
					continue;
				}

				const rows = decodeCsv(entry.data);
				const knownFields = new Set(
					Object.keys(Schema[tableName as keyof typeof Schema]),
				);
				const upsertRows = rows
					.map((row) => {
						const importRow = Object.fromEntries(
							Object.entries(row).filter(([key]) => knownFields.has(key)),
						) as Record<string, unknown>;
						delete importRow.createdAt;
						delete importRow.updatedAt;
						delete importRow.ownerId;
						return importRow;
					})
					.filter((row) => typeof row.id === "string");

				for (let i = 0; i < upsertRows.length; i += batchSize) {
					const batch = upsertRows.slice(i, i + batchSize);
					await new Promise<void>((resolve) => {
						for (const [index, importRow] of batch.entries()) {
							const isLast = index === batch.length - 1;
							getOrThrow(
								evolu.upsert(
									tableName as never,
									importRow as never,
									isLast
										? {
												onComplete: () => {
													resolve();
												},
											}
										: undefined,
								),
							);
						}
					});

					importedRows += batch.length;
				}

				if (upsertRows.length > 0) {
					importedTables++;
				}
			}

			setMessage(
				t("admin:debug.storage.import.success", {
					importedRows,
					importedTables,
				}),
			);
		} catch (error) {
			console.error(error);
			setMessage(
				error instanceof Error
					? t("admin:debug.storage.import.failedWithReason", {
							message: error.message,
						})
					: t("admin:debug.storage.import.failed"),
			);
		} finally {
			setLoading(false);
			event.target.value = "";
		}
	};

	return (
		<div className="space-y-2">
			<input
				ref={inputRef}
				type="file"
				accept=".zip,application/zip"
				className="hidden"
				onChange={handleFileChange}
			/>

			<Button
				type="button"
				disabled={isLoading}
				onClick={() => {
					inputRef.current?.click();
				}}
			>
				{isLoading ? (
					<LoaderCircleIcon className="animate-spin" />
				) : (
					<IconUpload />
				)}
				{t("admin:debug.common.import")}
			</Button>

			{message !== null && (
				<div className="text-sm text-muted-foreground">{message}</div>
			)}
		</div>
	);
};

const RandomDataGenerator = () => {
	const { t } = useTranslation();
	const [isLoading, setLoading] = useState(false);
	const evolu = useEvolu();

	const generateData = async () => {
		setLoading(true);

		try {
			Array(100)
				.keys()
				.forEach(() => {
					getOrThrow(
						evolu.insert("item", {
							categoryId: null,
							label: faker.food.dish(),
							priceValue: faker.number.int({ min: 50, max: 600 }),
							priceCurrency: Currency.CZK,
						}),
					);
				});

			const tableIds: string[] = [];
			Array(4)
				.keys()
				.forEach((index) => {
					const { id } = getOrThrow(
						evolu.insert("table", {
							label: `Hall ${(index + 1).toString().padStart(2, "0")}`,
							numberOfSeats: faker.number.int({ min: 2, max: 8 }),
						}),
					);
					tableIds.push(id);
				});

			Array(2)
				.keys()
				.forEach((index) => {
					const { id } = getOrThrow(
						evolu.insert("table", {
							label: `Bar ${(index + 1).toString().padStart(2, "0")}`,
							numberOfSeats: faker.number.int({ min: 2, max: 4 }),
						}),
					);
					tableIds.push(id);
				});

			Array(6)
				.keys()
				.forEach((index) => {
					const { id } = getOrThrow(
						evolu.insert("table", {
							label: `Garden ${(index + 1).toString().padStart(2, "0")}`,
							numberOfSeats: faker.number.int({ min: 4, max: 10 }),
						}),
					);
					tableIds.push(id);
				});

			tableIds.map((tableId, index) =>
				getOrThrow(
					evolu.insert("tableCode", {
						tableId,
						code: (index + 1).toString().padStart(3, "0"),
					}),
				),
			);

			const billingSettingsRows = await evolu.loadQuery(
				evolu.createQuery((db) =>
					db
						.selectFrom("billingSettings")
						.select([
							"billingSettings.defaultTimezone as defaultTimezone",
						] as const)
						.where("billingSettings.isDeleted", "is not", sqliteTrue)
						.where("billingSettings.id", "=", createIdFromString("")),
				),
			);
			const timezone =
				billingSettingsRows[0]?.defaultTimezone ?? "Europe/Prague";
			const slotMinutes = 30;
			const slotMs = slotMinutes * 60 * 1000;
			const reservationWindowStartMinutes = 8 * 60;
			const reservationWindowEndMinutes = 22 * 60;
			const dayLabels = [new Date(), addDays(new Date(), 1)].map((date) =>
				formatInTimeZone(date, timezone, "yyyy-MM-dd"),
			);

			const targetTableIds = tableIds as Id[];

			const hasOverlap = (
				intervals: Array<{ start: number; end: number }>,
				start: number,
				end: number,
			) => intervals.some((item) => start < item.end && end > item.start);

			for (const tableId of targetTableIds) {
				for (const dayLabel of dayLabels) {
					const intervals: Array<{ start: number; end: number }> = [];
					const dayStart = fromZonedTime(
						`${dayLabel}T00:00:00`,
						timezone,
					).getTime();
					const windowStartMs =
						dayStart + reservationWindowStartMinutes * 60 * 1000;
					const windowEndMs =
						dayStart + reservationWindowEndMinutes * 60 * 1000;
					let cursorMs = windowStartMs;
					let insertedForDay = 0;

					while (cursorMs + slotMs <= windowEndMs) {
						const gapSlots = faker.number.int({ min: 0, max: 2 });
						cursorMs += gapSlots * slotMs;
						if (cursorMs + slotMs > windowEndMs) {
							break;
						}

						const remainingSlots = Math.floor(
							(windowEndMs - cursorMs) / slotMs,
						);
						if (remainingSlots < 2) {
							break;
						}
						const durationSlots = faker.number.int({
							min: 2,
							max: Math.min(6, remainingSlots),
						});
						const startAt = cursorMs;
						const endAt = startAt + durationSlots * slotMs;

						if (hasOverlap(intervals, startAt, endAt)) {
							cursorMs += slotMs;
							continue;
						}

						const note =
							faker.helpers.maybe(() => faker.lorem.sentence(), {
								probability: 0.35,
							}) ?? null;
						const phone =
							faker.helpers.maybe(() => faker.phone.number(), {
								probability: 0.55,
							}) ?? null;
						const email =
							faker.helpers.maybe(() => faker.internet.email(), {
								probability: 0.45,
							}) ?? null;
						const numberOfPeople = faker.number.int({ min: 1, max: 8 });

						const { id: reservationId } = getOrThrow(
							evolu.insert("reservation", {
								tableId,
								note,
								_tag: "reservationBooking",
								startAt,
								endAt,
							}),
						);
						getOrThrow(
							evolu.upsert("reservationBooking", {
								id: reservationId,
								name: faker.person.fullName(),
								phone,
								email,
								numberOfPeople,
								approvalStatus: faker.helpers.arrayElement([
									"approved",
									"approved",
									"pending",
								]),
								serviceStatus: "upcoming",
								statusReason: null,
								source: faker.helpers.arrayElement(["manual", "phone", "web"]),
							}),
						);

						intervals.push({ start: startAt, end: endAt });
						insertedForDay += 1;
						cursorMs = endAt;
					}

					if (insertedForDay === 0) {
						// Fallback: make sure each target table gets at least one reservation
						for (
							let candidateStart = windowStartMs;
							candidateStart + 2 * slotMs <= windowEndMs;
							candidateStart += slotMs
						) {
							const candidateEnd = candidateStart + 2 * slotMs; // 60 min
							if (hasOverlap(intervals, candidateStart, candidateEnd)) {
								continue;
							}

							const note =
								faker.helpers.maybe(() => faker.lorem.sentence(), {
									probability: 0.35,
								}) ?? null;
							const phone =
								faker.helpers.maybe(() => faker.phone.number(), {
									probability: 0.55,
								}) ?? null;
							const email =
								faker.helpers.maybe(() => faker.internet.email(), {
									probability: 0.45,
								}) ?? null;
							const numberOfPeople = faker.number.int({ min: 1, max: 8 });

							const { id: reservationId } = getOrThrow(
								evolu.insert("reservation", {
									tableId,
									note,
									_tag: "reservationBooking",
									startAt: candidateStart,
									endAt: candidateEnd,
								}),
							);
							getOrThrow(
								evolu.upsert("reservationBooking", {
									id: reservationId,
									name: faker.person.fullName(),
									phone,
									email,
									numberOfPeople,
									approvalStatus: faker.helpers.arrayElement([
										"approved",
										"approved",
										"pending",
									]),
									serviceStatus: "upcoming",
									statusReason: null,
									source: faker.helpers.arrayElement([
										"manual",
										"phone",
										"web",
									]),
								}),
							);
							intervals.push({ start: candidateStart, end: candidateEnd });
							break;
						}
					}
				}
			}

			if (targetTableIds.length > 0) {
				const blockDurationMs = 5 * 60 * 60 * 1000;
				const blockDayLabel = dayLabels[0];
				const blockTableId = faker.helpers.arrayElement(targetTableIds);
				const latestBlockStartMinutes =
					reservationWindowEndMinutes - blockDurationMs / (60 * 1000);
				const maxStartSlot = Math.max(
					0,
					Math.floor(
						(latestBlockStartMinutes - reservationWindowStartMinutes) /
							slotMinutes,
					),
				);
				const startSlot = faker.number.int({ min: 0, max: maxStartSlot });
				const blockStartMinutes =
					reservationWindowStartMinutes + startSlot * slotMinutes;
				const blockDayStart = fromZonedTime(
					`${blockDayLabel}T00:00:00`,
					timezone,
				).getTime();
				const blockStartAt = blockDayStart + blockStartMinutes * 60 * 1000;
				const blockEndAt = blockStartAt + blockDurationMs;

				const { id: blockReservationId } = getOrThrow(
					evolu.insert("reservation", {
						tableId: blockTableId,
						note: "Automaticky vygenerovaná blokace",
						_tag: "reservationBlock",
						startAt: blockStartAt,
						endAt: blockEndAt,
					}),
				);
				getOrThrow(
					evolu.upsert("reservationBlock", {
						id: blockReservationId,
						label: "Technická blokace",
					}),
				);
			}

			const sourceItems = await evolu.loadQuery(
				evolu.createQuery((db) =>
					db
						.selectFrom("item")
						.select([
							"item.id as id",
							"item.label as label",
							"item.priceValue as priceValue",
							"item.priceCurrency as priceCurrency",
							"item.unitOfMeasure as unitOfMeasure",
							"item.internalCode as internalCode",
							"item.productCodeType as productCodeType",
							"item.productCodeValue as productCodeValue",
						] as const)
						.where("item.isDeleted", "is not", sqliteTrue)
						.orderBy("item.label", "asc"),
				),
			);

			const normalizedSourceItems = sourceItems.flatMap((item) => {
				if (
					item.label === null ||
					item.priceValue === null ||
					item.priceCurrency === null
				) {
					return [];
				}
				return [
					{
						id: item.id,
						label: item.label,
						priceValue: item.priceValue,
						priceCurrency: item.priceCurrency,
						unitOfMeasure: item.unitOfMeasure,
						internalCode: item.internalCode,
						productCodeType: item.productCodeType,
						productCodeValue: item.productCodeValue,
					},
				];
			});

			if (normalizedSourceItems.length > 0) {
				const shuffledSourceItems = faker.helpers.shuffle(
					normalizedSourceItems,
				);
				let sourceItemCursor = 0;
				const takeSourceItems = (count: number) => {
					const items = [];
					for (let index = 0; index < count; index += 1) {
						items.push(
							shuffledSourceItems[
								sourceItemCursor % shuffledSourceItems.length
							],
						);
						sourceItemCursor += 1;
					}
					return items.sort((a, b) =>
						a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
					);
				};

				const middayStartHour = 11;
				const middayEndHour = 14;
				const toZonedTimestamp = (dayLabel: string, hour: number) =>
					fromZonedTime(
						`${dayLabel}T${hour.toString().padStart(2, "0")}:00:00`,
						timezone,
					).getTime();

				const menuBlueprints: Array<{
					name: string;
					validFrom: number | null;
					validTo: number | null;
					publishedAt: number | null;
					categories: Array<{ name: string; itemsCount: number }>;
				}> = [
					{
						name: "Stálá nabídka",
						validFrom: null,
						validTo: null,
						publishedAt: null,
						categories: [
							{ name: "Předkrmy", itemsCount: 4 },
							{ name: "Hlavní jídla", itemsCount: 8 },
							{ name: "Nápoje", itemsCount: 6 },
						],
					},
					{
						name: `Polední menu ${formatInTimeZone(new Date(), timezone, "d.M.yyyy")}`,
						validFrom: toZonedTimestamp(dayLabels[0], middayStartHour),
						validTo: toZonedTimestamp(dayLabels[0], middayEndHour),
						publishedAt: null,
						categories: [
							{ name: "Polévky", itemsCount: 2 },
							{ name: "Hlavní jídla", itemsCount: 5 },
							{ name: "Dezerty", itemsCount: 2 },
						],
					},
					{
						name: `Polední menu ${formatInTimeZone(addDays(new Date(), 1), timezone, "d.M.yyyy")}`,
						validFrom: toZonedTimestamp(dayLabels[1], middayStartHour),
						validTo: toZonedTimestamp(dayLabels[1], middayEndHour),
						publishedAt: null,
						categories: [
							{ name: "Polévky", itemsCount: 2 },
							{ name: "Hlavní jídla", itemsCount: 5 },
							{ name: "Dezerty", itemsCount: 2 },
						],
					},
				];

				for (const menuBlueprint of menuBlueprints) {
					const { id: menuId } = getOrThrow(
						evolu.insert("menu", {
							name: menuBlueprint.name,
							status: MenuStatus.Published,
							validFrom: menuBlueprint.validFrom,
							validTo: menuBlueprint.validTo,
							publishedAt: menuBlueprint.publishedAt,
						}),
					);

					for (const category of menuBlueprint.categories) {
						const { id: menuCategoryId } = getOrThrow(
							evolu.insert("menuCategory", {
								menuId: menuId as Id,
								name: category.name,
							}),
						);

						for (const sourceItem of takeSourceItems(category.itemsCount)) {
							getOrThrow(
								evolu.insert("menuItem", {
									menuCategoryId: menuCategoryId as Id,
									sourceItemId: sourceItem.id as Id,
									label: sourceItem.label,
									priceValue: sourceItem.priceValue,
									priceCurrency: sourceItem.priceCurrency,
									unitOfMeasure: sourceItem.unitOfMeasure,
									internalCode: sourceItem.internalCode,
									productCodeType: sourceItem.productCodeType,
									productCodeValue: sourceItem.productCodeValue,
								}),
							);
						}
					}
				}
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button type="button" onClick={generateData}>
			{isLoading ? (
				<LoaderCircleIcon className="animate-spin" />
			) : (
				<IconReload />
			)}
			{t("admin:debug.common.generate")}
		</Button>
	);
};

export default function Home() {
	const { t } = useTranslation();
	const commitHash =
		process.env.NEXT_PUBLIC_GIT_COMMIT || t("admin:debug.application.unknown");
	const { ndk } = useNostr();
	const nostrRelays = useNostrRelays();
	const { data: unpublishedEvents } = useQuery({
		queryKey: [],
		queryFn: () =>
			ndk.cacheAdapter && ndk.cacheAdapter.getUnpublishedEvents
				? ndk.cacheAdapter.getUnpublishedEvents()
				: null,
	});

	const getRelayStatus = ndk.cacheAdapter && ndk.cacheAdapter.getRelayStatus;

	return (
		<div className="w-full lg:max-w-7xl flex flex-col gap-4">
			<ResponsiveCard className="w-full">
				<CardHeader>
					<CardTitle>{t("admin:dashboard.applicationInformation")}</CardTitle>
				</CardHeader>
				<CardContent>
					<KeyValueList
						items={[
							{
								key: t("admin:debug.application.version"),
								value: commitHash,
							},
						]}
					/>
				</CardContent>
			</ResponsiveCard>

			<ResponsiveCard className="w-full">
				<CardHeader>
					<CardTitle>{t("admin:dashboard.sqliteData")}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-8">
					<div>{t("admin:debug.exportWarning")}</div>

					<div>
						<DownloadSqliteData />
					</div>
				</CardContent>
			</ResponsiveCard>

			<ResponsiveCard className="w-full">
				<CardHeader>
					<CardTitle>{t("admin:dashboard.storageData")}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-8">
					<div>{t("admin:debug.exportWarning")}</div>

					<div>
						<DownloadStorageData />
					</div>

					<div>
						<UploadStorageData />
					</div>
				</CardContent>
			</ResponsiveCard>

			<ResponsiveCard className="w-full">
				<CardHeader>
					<CardTitle>{t("admin:dashboard.randomDataGenerator")}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-8">
					<div>
						<RandomDataGenerator />
					</div>
				</CardContent>
			</ResponsiveCard>

			{ndk.cacheAdapter && (
				<ResponsiveCard className="w-full">
					<CardHeader>
						<CardTitle>{t("admin:dashboard.nostrRelays")}</CardTitle>
					</CardHeader>
					<CardContent>
						{getRelayStatus !== undefined && (
							<KeyValueList
								items={nostrRelays.map((nostrRelay) => ({
									key: nostrRelay,
									value: JSON.stringify(
										getRelayStatus.bind(ndk.cacheAdapter)(nostrRelay.url),
									),
								}))}
							/>
						)}
					</CardContent>

					<CardHeader>
						<CardTitle>{t("admin:dashboard.nostrUnpublishedEvents")}</CardTitle>

						<CardContent>
							<pre className={"text-xs"}>
								{JSON.stringify(unpublishedEvents, null, 2)}
							</pre>
						</CardContent>
					</CardHeader>
				</ResponsiveCard>
			)}
		</div>
	);
}
