import { decode } from "light-bolt11-decoder";
import { assertNotUndefined } from "@/lib/type-utils";

export const extractExpirationFromLightningInvoice = (lnInvoice: string) => {
	const decodedLnInvoice = decode(lnInvoice);
	const timestamp = decodedLnInvoice.sections.find(
		(section) => section.name === "timestamp",
	);
	if (timestamp === undefined) {
		return null;
	}

	return new Date(decodedLnInvoice.expiry * 1000 + timestamp.value * 1000);
};

export const extractBtcAmountFromLightningInvoice = (lnInvoice: string) => {
	const decodedLnInvoice = decode(lnInvoice);
	const amount = decodedLnInvoice.sections.find(
		(section) => section.name === "amount",
	);

	assertNotUndefined(amount);

	return Number(amount.value) / 100000000 / 1000;
};
