"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	type Row,
	sqliteTrue,
} from "@evolu/common";
import { faker } from "@faker-js/faker";
import { IconDownload, IconReload, IconUpload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useAtomValue } from "jotai";
import { LoaderCircleIcon } from "lucide-react";
import {
	type ChangeEvent,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { accountAtom } from "@/atoms/account";
import { FullscreenContainer } from "@/components/fullscreen-container";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";
import { useNostrRelays } from "@/hooks/use-nostr-relays";
import { AppSchema, createQuery } from "@/lib/evolu";
import { MenuStatus } from "@/lib/evolu/model/menu";
import type { Id } from "@/lib/evolu/types";
import {
	createCatalogItem,
	createItemFromCatalogItem,
} from "@/lib/item/service";
import { decodeCsv, encodeCsv } from "@/lib/shared/files/csv";
import { downloadFile } from "@/lib/shared/files/file-utils";
import { createZip, extractZip } from "@/lib/shared/files/zip";
import {
	Currency,
	Email,
	Integer,
	NonEmptyString,
	NonEmptyString255,
	Phone,
	PositiveInteger,
	TimestampMs,
} from "@/lib/shared/types";

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
			if (event.origin !== "https://yzua.github.io") return;

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
						"https://yzua.github.io/sqlite-online/",
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
					src="https://yzua.github.io/sqlite-online/"
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
			const tableNames = Object.keys(AppSchema).sort();
			const files: Array<{ name: string; data: Uint8Array }> = [];

			for (const tableName of tableNames) {
				const rows = await evolu.loadQuery<Row>(
					createQuery((db) => db.selectFrom(tableName as any).selectAll()),
				);
				files.push({
					name: `${tableName}.csv`,
					data: encodeCsv(rows as Array<Record<string, unknown>>),
				});
			}

			const zipBytes = createZip(files);

			await downloadFile({
				bytes: [new Blob([zipBytes.buffer as ArrayBuffer])],
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

			const knownTables = new Set(Object.keys(AppSchema));
			let importedRows = 0;
			let importedTables = 0;

			for (const entry of files) {
				const tableName = entry.name.replace(/\.csv$/u, "");
				if (!knownTables.has(tableName)) {
					continue;
				}

				const rows = decodeCsv(entry.data);
				const knownFields = new Set(
					Object.keys(AppSchema[tableName as keyof typeof AppSchema]),
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
	const account = useAtomValue(accountAtom);

	const generateData = async () => {
		setLoading(true);

		try {
			Array(100)
				.keys()
				.forEach(() => {
					evolu.insert("catalogItem", {
						deviceId: account.device.id,
						categoryId: null,
						label: NonEmptyString255(faker.food.dish()),
						price: Integer(faker.number.int({ min: 5000, max: 60000 })),
						currency: Currency.CZK,
					});
				});

			const tableIds: Id[] = [];
			Array(4)
				.keys()
				.forEach((index) => {
					const { id } = evolu.insert("table", {
						deviceId: account.device.id,
						label: NonEmptyString255(
							`Hall ${(index + 1).toString().padStart(2, "0")}`,
						),
						numberOfSeats: PositiveInteger(
							faker.number.int({ min: 2, max: 8 }),
						),
					});
					tableIds.push(id);
				});

			Array(2)
				.keys()
				.forEach((index) => {
					const { id } = evolu.insert("table", {
						deviceId: account.device.id,
						label: NonEmptyString255(
							`Bar ${(index + 1).toString().padStart(2, "0")}`,
						),
						numberOfSeats: PositiveInteger(
							faker.number.int({ min: 2, max: 4 }),
						),
					});
					tableIds.push(id);
				});

			Array(6)
				.keys()
				.forEach((index) => {
					const { id } = evolu.insert("table", {
						deviceId: account.device.id,
						label: NonEmptyString255(
							`Garden ${(index + 1).toString().padStart(2, "0")}`,
						),
						numberOfSeats: PositiveInteger(
							faker.number.int({ min: 4, max: 10 }),
						),
					});
					tableIds.push(id);
				});

			tableIds.map((tableId, index) =>
				evolu.insert("tableCode", {
					tableId,
					code: NonEmptyString255((index + 1).toString().padStart(3, "0")),
				}),
			);

			const billingSettingsRows = await evolu.loadQuery(
				createQuery((db) =>
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
							faker.helpers.maybe(
								() => NonEmptyString(faker.lorem.sentence()),
								{
									probability: 0.35,
								},
							) ?? null;
						const phone =
							faker.helpers.maybe(() => Phone(faker.phone.number()), {
								probability: 0.55,
							}) ?? null;
						const email =
							faker.helpers.maybe(() => Email(faker.internet.email()), {
								probability: 0.45,
							}) ?? null;
						const numberOfPeople = PositiveInteger(
							faker.number.int({ min: 1, max: 8 }),
						);

						const { id: reservationId } = evolu.insert("reservation", {
							deviceId: account.device.id,
							tableId,
							note,
							_tag: "booking",
							startAt: TimestampMs(startAt),
							endAt: TimestampMs(endAt),
						});
						evolu.upsert("reservationBooking", {
							id: reservationId,
							name: NonEmptyString255(faker.person.fullName()),
							phone,
							email,
							numberOfPeople,
							approvalStatus: faker.helpers.arrayElement([
								"approved",
								"rejected",
								"pending",
							] as const),
							serviceStatus: "upcoming",
							statusReason: null,
							source: faker.helpers.arrayElement(["manual", "phone", "web"]),
						});

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
								faker.helpers.maybe(
									() => NonEmptyString(faker.lorem.sentence()),
									{
										probability: 0.35,
									},
								) ?? null;
							const phone =
								faker.helpers.maybe(() => Phone(faker.phone.number()), {
									probability: 0.55,
								}) ?? null;
							const email =
								faker.helpers.maybe(() => Email(faker.internet.email()), {
									probability: 0.45,
								}) ?? null;
							const numberOfPeople = PositiveInteger(
								faker.number.int({ min: 1, max: 8 }),
							);

							const { id: reservationId } = evolu.insert("reservation", {
								deviceId: account.device.id,
								tableId,
								note,
								_tag: "booking",
								startAt: TimestampMs(candidateStart),
								endAt: TimestampMs(candidateEnd),
							});
							evolu.upsert("reservationBooking", {
								id: reservationId,
								name: NonEmptyString255(faker.person.fullName()),
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
							});
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

				const { id: blockReservationId } = evolu.insert("reservation", {
					tableId: blockTableId,
					note: NonEmptyString("Automaticky vygenerovaná blokace"),
					_tag: "block",
					startAt: TimestampMs(blockStartAt),
					endAt: TimestampMs(blockEndAt),
				});
				evolu.upsert("reservationBlock", {
					id: blockReservationId,
					label: NonEmptyString255("Technická blokace"),
				});
			}

			const sourceItems = await evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("catalogItem")
						.select([
							"catalogItem.id as id",
							"catalogItem.label as label",
							"catalogItem.price as price",
							"catalogItem.currency as currency",
							"catalogItem.unitOfMeasure as unitOfMeasure",
							"catalogItem.internalCode as internalCode",
							"catalogItem.productCodeType as productCodeType",
							"catalogItem.productCodeValue as productCodeValue",
						] as const)
						.where("catalogItem.isDeleted", "is not", sqliteTrue)
						.where("catalogItem.label", "is not", null)
						.where("catalogItem.price", "is not", null)
						.where("catalogItem.currency", "is not", null)
						.orderBy("catalogItem.label", "asc")
						.$narrowType<{
							label: KyselyNotNull;
							price: KyselyNotNull;
							currency: KyselyNotNull;
						}>(),
				),
			);

			if (sourceItems.length > 0) {
				const shuffledSourceItems = faker.helpers.shuffle(sourceItems);
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
					name: NonEmptyString255;
					validFrom: TimestampMs | null;
					validTo: TimestampMs | null;
					publishedAt: TimestampMs | null;
					categories: Array<{ name: NonEmptyString255; itemsCount: number }>;
				}> = [
					{
						name: NonEmptyString255("Stálá nabídka"),
						validFrom: null,
						validTo: null,
						publishedAt: null,
						categories: [
							{ name: NonEmptyString255("Předkrmy"), itemsCount: 4 },
							{ name: NonEmptyString255("Hlavní jídla"), itemsCount: 8 },
							{ name: NonEmptyString255("Nápoje"), itemsCount: 6 },
						],
					},
					{
						name: NonEmptyString255(
							`Polední menu ${formatInTimeZone(new Date(), timezone, "d.M.yyyy")}`,
						),
						validFrom: toZonedTimestamp(dayLabels[0], middayStartHour),
						validTo: toZonedTimestamp(dayLabels[0], middayEndHour),
						publishedAt: null,
						categories: [
							{ name: NonEmptyString255("Polévky"), itemsCount: 2 },
							{ name: NonEmptyString255("Hlavní jídla"), itemsCount: 5 },
							{ name: NonEmptyString255("Dezerty"), itemsCount: 2 },
						],
					},
					{
						name: NonEmptyString255(
							`Polední menu ${formatInTimeZone(addDays(new Date(), 1), timezone, "d.M.yyyy")}`,
						),
						validFrom: toZonedTimestamp(dayLabels[1], middayStartHour),
						validTo: toZonedTimestamp(dayLabels[1], middayEndHour),
						publishedAt: null,
						categories: [
							{ name: NonEmptyString255("Polévky"), itemsCount: 2 },
							{ name: NonEmptyString255("Hlavní jídla"), itemsCount: 5 },
							{ name: NonEmptyString255("Dezerty"), itemsCount: 2 },
						],
					},
				];

				for (const menuBlueprint of menuBlueprints) {
					const { id: menuId } = evolu.insert("menu", {
						name: menuBlueprint.name,
						status: MenuStatus.Published,
						validFrom: menuBlueprint.validFrom,
						validTo: menuBlueprint.validTo,
						publishedAt: menuBlueprint.publishedAt,
					});

					for (const category of menuBlueprint.categories) {
						const { id: menuCategoryId } = evolu.insert("menuCategory", {
							menuId: menuId,
							name: category.name,
						});

						for (const sourceItem of takeSourceItems(category.itemsCount)) {
							const catalogItem = createCatalogItem({ evolu })({
								catalogItem: {
									deviceId: account.device.id,
									categoryId: null,
									label: sourceItem.label,
									price: sourceItem.price,
									currency: sourceItem.currency,
									unitOfMeasure: sourceItem.unitOfMeasure,
									internalCode: sourceItem.internalCode,
									productCodeType: sourceItem.productCodeType,
									productCodeValue: sourceItem.productCodeValue,
								},
							});
							const item = await createItemFromCatalogItem({ evolu })({
								catalogItem,
							});
							evolu.insert("menuItemLine", {
								itemId: item.id,
								catalogItemId: catalogItem.id,
								menuCategoryId: menuCategoryId,
								availabilityStatus: null,
							});
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
									key: nostrRelay.url,
									value: JSON.stringify(
										getRelayStatus.bind(ndk.cacheAdapter)(nostrRelay.url),
									),
								}))}
							/>
						)}
					</CardContent>

					<CardHeader>
						<CardTitle>{t("admin:dashboard.nostrUnpublishedEvents")}</CardTitle>
					</CardHeader>
					<CardContent>
						<pre className={"text-xs"}>
							{JSON.stringify(unpublishedEvents, null, 2)}
						</pre>
					</CardContent>
				</ResponsiveCard>
			)}
		</div>
	);
}
