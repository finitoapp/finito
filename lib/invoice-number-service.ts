import { format } from "date-fns-tz";
import { isTheSameDateString } from "@/lib/date-string-utils";
import type { EnhancedNDK } from "@/lib/nostr-storage";
import {
	type DateString,
	DateToDateString,
	NonNegativeInteger,
	Timezone,
} from "@/lib/types";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";
import { invoiceLastNumberStorage } from "@/storages/invoice-last-number-storage";
import { invoiceNumberSeriesStorage } from "@/storages/invoice-number-series-storage";

export const resolveSubsequentInvoiceNumber = async (deps: {
	ndk: EnhancedNDK;
}) => {
	const [invoiceLastNumbersData, invoiceNumberSeriesData, billingSettingsData] =
		await Promise.all([
			invoiceLastNumberStorage.select(
				{ ndk: deps.ndk },
				{ key: null, limit: 1 },
			),
			invoiceNumberSeriesStorage.select(
				{ ndk: deps.ndk },
				{ key: null, limit: 1 },
			),
			billingSettingsStorage.select({ ndk: deps.ndk }, { key: null, limit: 1 }),
		]);

	const invoiceLastNumbers = invoiceLastNumbersData.data[0]?.value ?? {
		serialNumber: 0,
		date: null,
	};
	const invoiceNumberSeries = invoiceNumberSeriesData.data[0]?.value ?? {
		serialNumberDigits: 4,
		yearFormat: "default",
		monthFormat: "hidden",
	};
	const billingSettings = billingSettingsData.data[0]?.value ?? {
		defaultTimezone: Timezone["Europe/Prague"],
	};

	return computeSubsequentInvoiceNumber({
		now: new Date(),
		timezone: billingSettings.defaultTimezone,
		yearFormat: invoiceNumberSeries.yearFormat,
		monthFormat: invoiceNumberSeries.monthFormat,
		dayFormat:
			"dayFormat" in invoiceNumberSeries
				? invoiceNumberSeries.dayFormat
				: "hidden",
		serialNumberDigits: invoiceNumberSeries.serialNumberDigits,
		prefix: invoiceNumberSeries.prefix ?? "",
		lastSerialNumber: invoiceLastNumbers.serialNumber,
		lastDate: invoiceLastNumbers.date,
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
