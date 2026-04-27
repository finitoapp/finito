"use client";

import {
	Document,
	Font,
	Page,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import type React from "react";
import { useTranslation } from "react-i18next";
import {
	type PaymentReceipt,
	PaymentReceiptLineKind,
} from "@/lib/evolu/model/payment-receipt";
import { CountryCode } from "@/lib/shared/types";
import { formatMoney, formatPostalCode } from "@/lib/shared/utils/format";

Font.register({
	family: "Roboto",
	fonts: [
		{
			src: "/font/Roboto-Regular.ttf",
			fontWeight: 400,
		},
		{
			src: "/font/Roboto-Bold.ttf",
			fontWeight: 700,
		},
	],
});

const RECEIPT_PAGE_WIDTH = 298;
const RECEIPT_PAGE_MIN_HEIGHT = 420;
const RECEIPT_PAGE_BASE_HEIGHT = 320;
const RECEIPT_PAGE_ITEM_HEIGHT = 34;

const styles = StyleSheet.create({
	page: {
		backgroundColor: "#ffffff",
		paddingVertical: 12,
		paddingHorizontal: 12,
		fontFamily: "Roboto",
		fontSize: 7,
		lineHeight: 1.4,
		color: "#111827",
	},
	receipt: {
		paddingHorizontal: 6,
		paddingVertical: 4,
	},
	centered: {
		alignItems: "center",
		textAlign: "center",
	},
	section: {
		marginBottom: 8,
	},
	separator: {
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		borderBottomStyle: "dashed",
		marginVertical: 8,
	},
	supplierName: {
		fontSize: 10,
		fontWeight: "bold",
		marginBottom: 2,
	},
	title: {
		fontSize: 11,
		fontWeight: "bold",
		letterSpacing: 0.8,
		marginBottom: 2,
	},
	subtitle: {
		fontSize: 6.5,
		color: "#4b5563",
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},
	muted: {
		color: "#6b7280",
	},
	metaBlock: {
		paddingVertical: 2,
	},
	metaRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 1,
	},
	metaLabel: {
		fontSize: 6.5,
		color: "#6b7280",
		paddingRight: 12,
	},
	metaValue: {
		fontSize: 7,
		textAlign: "right",
	},
	sectionTitle: {
		fontSize: 6,
		fontWeight: "bold",
		letterSpacing: 0.7,
		textTransform: "uppercase",
		color: "#6b7280",
		marginBottom: 3,
	},
	supplierBlock: {
		paddingBottom: 2,
	},
	addressText: {
		fontSize: 7,
		marginBottom: 1,
	},
	itemsHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingBottom: 3,
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
	},
	itemsHeaderText: {
		fontSize: 6,
		fontWeight: "bold",
		letterSpacing: 0.6,
		textTransform: "uppercase",
		color: "#6b7280",
	},
	itemRow: {
		paddingVertical: 5,
		borderBottomWidth: 1,
		borderBottomColor: "#f5f5f5",
	},
	itemTopRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 1,
	},
	itemLabel: {
		fontSize: 7,
		width: "68%",
		paddingRight: 8,
	},
	itemTotal: {
		fontSize: 7,
		fontWeight: "bold",
		textAlign: "right",
	},
	itemMeta: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	itemDetails: {
		fontSize: 6.5,
		color: "#6b7280",
	},
	totalBlock: {
		marginTop: 4,
		borderTopWidth: 1,
		borderTopColor: "#d1d5db",
		paddingTop: 6,
		paddingBottom: 2,
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	totalLabel: {
		fontSize: 7,
		fontWeight: "bold",
		color: "#374151",
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},
	totalValue: {
		fontSize: 9,
		fontWeight: "bold",
		color: "#111827",
	},
	footer: {
		marginTop: 8,
		paddingTop: 6,
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
		borderTopStyle: "dashed",
		textAlign: "center",
		fontSize: 6,
		color: "#6b7280",
	},
});

const resolveCountryLabel = (
	t: ReturnType<typeof useTranslation>["t"],
	countryCode: string,
) => {
	if (countryCode === CountryCode.CZ) {
		return t("payments:receipt.pdf.country.cz");
	}

	return countryCode;
};

const resolveLineLabel = (
	t: ReturnType<typeof useTranslation>["t"],
	line: PaymentReceipt["items"][number],
) => {
	if (line.kind === PaymentReceiptLineKind.Tip) {
		return t("payments:receipt.line.tip");
	}

	if (line.kind === PaymentReceiptLineKind.Payment) {
		return t("payments:receipt.line.payment");
	}

	if (line.kind === PaymentReceiptLineKind.SettlementAdjustment) {
		return t("payments:receipt.line.settlement-adjustment");
	}

	return line.label ?? "-";
};

export const PaymentReceiptTemplate: React.FC<{
	receipt: PaymentReceipt;
}> = ({ receipt }) => {
	const { i18n, t } = useTranslation();
	const locale = i18n.language.startsWith("cs") ? "cs-CZ" : "en-US";
	const pageHeight = Math.max(
		RECEIPT_PAGE_MIN_HEIGHT,
		RECEIPT_PAGE_BASE_HEIGHT + receipt.items.length * RECEIPT_PAGE_ITEM_HEIGHT,
	);

	return (
		<Document>
			<Page
				size={{ width: RECEIPT_PAGE_WIDTH, height: pageHeight }}
				style={styles.page}
				wrap={false}
			>
				<View style={styles.receipt}>
					<View style={[styles.section, styles.centered]}>
						<Text style={styles.supplierName}>
							{receipt.paymentReceiptSupplier.name}
						</Text>
						{receipt.paymentReceiptSupplierAddress.street && (
							<Text>
								{receipt.paymentReceiptSupplierAddress.street}{" "}
								{receipt.paymentReceiptSupplierAddress.descriptiveNumber ?? ""}
							</Text>
						)}
						{(receipt.paymentReceiptSupplierAddress.city ||
							receipt.paymentReceiptSupplierAddress.postalCode) && (
							<Text>
								{receipt.paymentReceiptSupplierAddress.city ?? ""}
								{receipt.paymentReceiptSupplierAddress.city &&
								receipt.paymentReceiptSupplierAddress.postalCode
									? ", "
									: ""}
								{receipt.paymentReceiptSupplierAddress.postalCode
									? formatPostalCode(
											receipt.paymentReceiptSupplierAddress.postalCode,
										)
									: ""}
							</Text>
						)}
						<Text style={styles.muted}>
							{resolveCountryLabel(
								t,
								receipt.paymentReceiptSupplierBillingInfo.countryCode,
							)}
						</Text>
					</View>

					<View style={[styles.section, styles.centered]}>
						<Text style={styles.title}>{t("payments:receipt.pdf.title")}</Text>
						<Text style={styles.subtitle}>#{receipt.receiptNumber}</Text>
					</View>

					<View style={styles.metaBlock}>
						<View style={styles.metaRow}>
							<Text style={styles.metaLabel}>
								{t("payments:receipt.pdf.issuedAt")}
							</Text>
							<Text style={styles.metaValue}>
								{new Date(receipt.issuedAt).toLocaleString(locale)}
							</Text>
						</View>
						<View style={styles.metaRow}>
							<Text style={styles.metaLabel}>
								{t("payments:receipt.pdf.paymentDate")}
							</Text>
							<Text style={styles.metaValue}>
								{new Date(receipt.paymentCreatedAt).toLocaleString(locale)}
							</Text>
						</View>
						<View style={styles.metaRow}>
							<Text style={styles.metaLabel}>
								{t("payments:receipt.pdf.receiptNumber")}
							</Text>
							<Text style={styles.metaValue}>{receipt.receiptNumber}</Text>
						</View>
					</View>

					<View style={styles.separator} />

					<View style={styles.section}>
						<Text style={styles.sectionTitle}>
							{t("payments:receipt.pdf.supplier")}
						</Text>
						<View style={styles.supplierBlock}>
							<Text style={styles.addressText}>
								{receipt.paymentReceiptSupplier.name}
							</Text>
							{receipt.paymentReceiptSupplierBillingInfoCz
								.identificationNumber && (
								<Text style={styles.addressText}>
									{t("payments:receipt.pdf.identificationNumber")}{" "}
									{
										receipt.paymentReceiptSupplierBillingInfoCz
											.identificationNumber
									}
								</Text>
							)}
							{receipt.paymentReceiptSupplierBillingInfoCz.vatNumber && (
								<Text style={styles.addressText}>
									{t("payments:receipt.pdf.vatNumber")}{" "}
									{receipt.paymentReceiptSupplierBillingInfoCz.vatNumber}
								</Text>
							)}
						</View>
					</View>

					<View style={styles.separator} />

					<View style={styles.section}>
						<View style={styles.itemsHeader}>
							<Text style={styles.itemsHeaderText}>
								{t("payments:receipt.pdf.columns.label")}
							</Text>
							<Text style={styles.itemsHeaderText}>
								{t("payments:receipt.pdf.columns.total")}
							</Text>
						</View>

						{receipt.items.map((line) => (
							<View key={line.id} style={styles.itemRow}>
								<View style={styles.itemTopRow}>
									<Text style={styles.itemLabel}>
										{resolveLineLabel(t, line)}
									</Text>
									<Text style={styles.itemTotal}>
										{formatMoney(
											{
												value: line.totalAmount,
												currency: receipt.currency,
											},
											locale,
										)}
									</Text>
								</View>
								<View style={styles.itemMeta}>
									<Text style={styles.itemDetails}>
										{line.quantity.toLocaleString(locale)}{" "}
										{line.unitOfMeasure ?? "-"} x{" "}
										{formatMoney(
											{
												value: line.unitPrice,
												currency: receipt.currency,
											},
											locale,
										)}
									</Text>
									<Text style={styles.itemDetails}>
										{t("payments:receipt.pdf.columns.unit")}
									</Text>
								</View>
							</View>
						))}
					</View>

					<View style={styles.totalBlock}>
						<View style={styles.totalRow}>
							<Text style={styles.totalLabel}>
								{t("payments:receipt.pdf.total")}
							</Text>
							<Text style={styles.totalValue}>
								{formatMoney(
									{
										value: receipt.totalAmount,
										currency: receipt.currency,
									},
									locale,
								)}
							</Text>
						</View>
					</View>

					<Text style={styles.footer}>
						{t("payments:receipt.pdf.title")} • {receipt.receiptNumber}
					</Text>
				</View>
			</Page>
		</Document>
	);
};
