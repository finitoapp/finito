import { createIdFromString, sqliteTrue } from "@evolu/common";
import { format } from "date-fns-tz";
import { isTheSameDateString } from "@/lib/date-string-utils";
import type { Evolu } from "@/lib/evolu";
import {
	type DateString,
	DateToDateString,
	NonNegativeInteger,
	Timezone,
} from "@/lib/types";

export const resolveSubsequentInvoiceNumber = async (deps: {
	evolu: Evolu;
}) => {
	const evolu = deps.evolu;
	const [invoiceLastNumbersRows, invoiceNumberSeriesRows, billingSettingsRows] =
		await Promise.all([
			(async () => {
				const query = evolu.createQuery((db) =>
					db
						.selectFrom("invoiceLastNumber")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", createIdFromString("")),
				);
				return await evolu.loadQuery(query);
			})(),
			(async () => {
				const query = evolu.createQuery((db) =>
					db
						.selectFrom("invoiceNumberSeries")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", createIdFromString("")),
				);
				return await evolu.loadQuery(query);
			})(),
			(async () => {
				const query = evolu.createQuery((db) =>
					db
						.selectFrom("billingSettings")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", createIdFromString("")),
				);
				return await evolu.loadQuery(query);
			})(),
		]);

	const invoiceLastNumbers = invoiceLastNumbersRows[0] ?? {
		serialNumber: 0,
		date: null,
	};
	const invoiceNumberSeries = invoiceNumberSeriesRows[0] ?? {
		serialNumberDigits: 4,
		yearFormat: "default",
		monthFormat: "hidden",
	};
	const billingSettings = billingSettingsRows[0] ?? {
		defaultTimezone: Timezone["Europe/Prague"],
	};

	return computeSubsequentInvoiceNumber({
		now: new Date(),
		timezone: billingSettings.defaultTimezone as Timezone,
		yearFormat: (invoiceNumberSeries.yearFormat ?? "default") as
			| "default"
			| "short",
		monthFormat: (invoiceNumberSeries.monthFormat ?? "hidden") as
			| "default"
			| "hidden",
		dayFormat: (invoiceNumberSeries.dayFormat ?? "hidden") as
			| "default"
			| "hidden",
		serialNumberDigits: invoiceNumberSeries.serialNumberDigits ?? 4,
		prefix: invoiceNumberSeries.prefix ?? "",
		lastSerialNumber: invoiceLastNumbers.serialNumber ?? 0,
		lastDate: invoiceLastNumbers.date as DateString | null,
	});
};

export const computeSubsequentInvoiceNumber = (props: {
	now: Date;
	timezone: Timezone;
	yearFormat: "default" | "short";
	monthFormat: "default" | "hidden";
	dayFormat: "default" | "hidden";
	serialNumberDigits: number;
	lastSerialNumber: number;
	lastDate: DateString | null;
	prefix: string;
}) => {
	const nowString = DateToDateString(props.now);

	const dateFormat = [props.yearFormat === "default" ? "yyyy" : "yy"];

	let theSameDate: boolean;
	if (props.monthFormat === "default") {
		dateFormat.push("MM");
		if (props.dayFormat === "default") {
			dateFormat.push("dd");
			theSameDate = nowString === props.lastDate;
		} else {
			theSameDate =
				props.lastDate !== null &&
				isTheSameDateString(nowString, props.lastDate, "year-month");
		}
	} else {
		theSameDate =
			props.lastDate !== null &&
			isTheSameDateString(nowString, props.lastDate, "year");
	}

	const dateString = format(props.now, dateFormat.join(""), {
		timeZone: props.timezone,
	});

	const nextSerialNumber = (theSameDate ? props.lastSerialNumber : 0) + 1;
	const serialNumberString = nextSerialNumber
		.toString()
		.padStart(props.serialNumberDigits, "0");

	return {
		invoiceNumber: `${props.prefix}${dateString}${serialNumberString}`,
		serialNumber: NonNegativeInteger(nextSerialNumber),
		date: nowString,
	};
};
