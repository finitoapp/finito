import { SparkWallet } from "@buildonspark/spark-sdk";
import type { EvoluSchemaType } from "@/lib/evolu";
import type { BtcWalletAdapter } from "@/lib/payment/btc-wallet/types";
import {
	NonEmptyString,
	NonNegativeInteger,
	TimestampMs,
} from "@/lib/shared/types";
import { extractPaymentHashFromLnInvoice } from "@/lib/shared/utils/ln";

type SparkConfig = EvoluSchemaType["accountSpark"];

const createSparkWallet = async (config: SparkConfig) => {
	const { wallet } = await SparkWallet.initialize({
		mnemonicOrSeed: config.mnemonic,
		options: {
			network: "MAINNET",
		},
	});

	return wallet;
};

const toSats = (value: unknown): NonNegativeInteger | null => {
	if (
		typeof value !== "object" ||
		value === null ||
		!("originalValue" in value) ||
		!("originalUnit" in value)
	) {
		return null;
	}

	const originalValue = value.originalValue;
	const originalUnit = value.originalUnit;
	if (typeof originalValue !== "number" || typeof originalUnit !== "string") {
		return null;
	}

	if (originalUnit === "SATOSHI") {
		return NonNegativeInteger(Math.trunc(originalValue));
	}

	if (originalUnit === "MILLISATOSHI") {
		return NonNegativeInteger(Math.trunc(originalValue / 1000));
	}

	return null;
};

const parseInvoiceExpiresAt = (value: string): TimestampMs => {
	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp) || timestamp <= 0) {
		throw new Error("Invalid Spark invoice expiration");
	}

	return TimestampMs(timestamp);
};

const resolveExpirySeconds = (
	expiresAt: TimestampMs | null | undefined,
): number | undefined => {
	if (expiresAt == null) {
		return undefined;
	}

	const seconds = Math.ceil((Number(expiresAt) - Date.now()) / 1000);
	if (seconds <= 0) {
		throw new Error("Invoice expiration must be in the future");
	}

	return seconds;
};

export const sparkBtcWalletAdapter: BtcWalletAdapter<"accountSpark"> = {
	tag: "accountSpark",

	async payInvoice(params) {
		const wallet = await createSparkWallet(params.config);

		try {
			const payment = await wallet.payLightningInvoice({
				invoice: params.input.invoice,
				maxFeeSats: params.input.maxFeeSats ?? 0,
				// amountSatsToSend: params.input.amountSats ?? 0,
			});

			const paymentHash = extractPaymentHashFromLnInvoice(params.input.invoice);

			const feePaidSats =
				toSats((payment as { fee?: unknown }).fee) ??
				toSats(
					(
						payment as {
							userRequest?: {
								fee?: unknown;
							};
						}
					).userRequest?.fee,
				);

			return {
				walletRequestId: NonEmptyString(payment.id),
				paymentHash,
				feePaidSats,
				raw: payment,
			};
		} finally {
			await wallet.cleanupConnections();
		}
	},

	async receiveInvoice(params) {
		const wallet = await createSparkWallet(params.config);

		try {
			const expirySeconds = resolveExpirySeconds(params.input.expiresAt);
			const invoice = await wallet.createLightningInvoice({
				amountSats: Number(params.input.amountSats),
				memo: params.input.memo ?? undefined,
				expirySeconds,
			});

			return {
				invoice: NonEmptyString(invoice.invoice.encodedInvoice),
				paymentHash: NonEmptyString(invoice.invoice.paymentHash.toLowerCase()),
				walletInvoiceId: NonEmptyString(invoice.id),
				expiresAt: parseInvoiceExpiresAt(invoice.invoice.expiresAt),
				raw: invoice,
			};
		} finally {
			await wallet.cleanupConnections();
		}
	},
};
