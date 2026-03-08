import { decode } from "light-bolt11-decoder";
import { Integer, NonEmptyString, TimestampSec } from "@/lib/shared/types";
import { assertNotUndefined } from "@/lib/shared/utils/type";

export const extractExpirationFromLightningInvoice = (lnInvoice: string) => {
	const decodedLnInvoice = decode(lnInvoice);
	const timestamp = decodedLnInvoice.sections.find(
		(section) => section.name === "timestamp",
	);

	assertNotUndefined(timestamp);

	return TimestampSec(decodedLnInvoice.expiry + timestamp.value);
};

export const extractBtcAmountFromLightningInvoice = (lnInvoice: string) => {
	const decodedLnInvoice = decode(lnInvoice);
	const amount = decodedLnInvoice.sections.find(
		(section) => section.name === "amount",
	);

	assertNotUndefined(amount);

	return Integer(Number(amount.value) / 1000); // Let's don't support mSats for now
};

export const extractPaymentHashFromLnInvoice = (
	lnInvoice: string,
): NonEmptyString => {
	const decoded = decode(lnInvoice);
	const paymentHash = decoded.sections.find(
		(section) => section.name === "payment_hash",
	);

	assertNotUndefined(paymentHash);

	return NonEmptyString(`${paymentHash.value}`.toLowerCase());
};
