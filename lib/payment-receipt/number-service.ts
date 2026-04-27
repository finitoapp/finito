import { createIdFromString, sqliteTrue } from "@evolu/common";
import { format } from "date-fns-tz";
import { createQuery, type Evolu } from "@/lib/evolu";
import {
	type DateString,
	DateToDateString,
	NonNegativeInteger,
	Timezone,
} from "@/lib/shared/types";
import { isTheSameDateString } from "@/lib/shared/utils/date-string";

export const resolveSubsequentPaymentReceiptNumber = async (deps: {
	evolu: Evolu;
}) => {
	const evolu = deps.evolu;
	const [receiptLastNumbersRows, receiptNumberSeriesRows, billingSettingsRows] =
		await Promise.all([
			(async () => {
				const query = createQuery((db) =>
					db
						.selectFrom("paymentReceiptLastNumber")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", createIdFromString("")),
				);
				return await evolu.loadQuery(query);
			})(),
			(async () => {
				const query = createQuery((db) =>
					db
						.selectFrom("paymentReceiptNumberSeries")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", createIdFromString("")),
				);
				return await evolu.loadQuery(query);
			})(),
			(async () => {
				const query = createQuery((db) =>
					db
						.selectFrom("billingSettings")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", createIdFromString("")),
				);
				return await evolu.loadQuery(query);
			})(),
		]);

	const receiptLastNumbers = receiptLastNumbersRows[0] ?? {
		serialNumber: 0,
		date: null,
	};
	const receiptNumberSeries = receiptNumberSeriesRows[0] ?? {
		serialNumberDigits: 4,
		yearFormat: "default",
		monthFormat: "hidden",
		prefix: "R",
	};
	const billingSettings = billingSettingsRows[0] ?? {
		defaultTimezone: Timezone["Europe/Prague"],
	};

	return computeSubsequentPaymentReceiptNumber({
		now: new Date(),
		timezone: billingSettings.defaultTimezone as Timezone,
		yearFormat: (receiptNumberSeries.yearFormat ?? "default") as
			| "default"
			| "short",
		monthFormat: (receiptNumberSeries.monthFormat ?? "hidden") as
			| "default"
			| "hidden",
		dayFormat: (receiptNumberSeries.dayFormat ?? "hidden") as
			| "default"
			| "hidden",
		serialNumberDigits: receiptNumberSeries.serialNumberDigits ?? 4,
		prefix: receiptNumberSeries.prefix ?? "R",
		lastSerialNumber: receiptLastNumbers.serialNumber ?? 0,
		lastDate: receiptLastNumbers.date as DateString | null,
	});
};

export const computeSubsequentPaymentReceiptNumber = (props: {
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
		receiptNumber: `${props.prefix}${dateString}${serialNumberString}`,
		serialNumber: NonNegativeInteger(nextSerialNumber),
		date: nowString,
	};
};
