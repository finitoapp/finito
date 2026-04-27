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

const styles = StyleSheet.create({
	page: {
		backgroundColor: "#ffffff",
		padding: 36,
		fontFamily: "Roboto",
		fontSize: 9,
		lineHeight: 1.45,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 18,
	},
	title: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#111827",
		marginBottom: 6,
	},
	subtitle: {
		fontSize: 10,
		color: "#4b5563",
	},
	section: {
		marginBottom: 18,
	},
	sectionTitle: {
		fontSize: 8,
		fontWeight: "bold",
		color: "#374151",
		marginBottom: 6,
		letterSpacing: 0.4,
	},
	grid: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	card: {
		width: "48%",
		padding: 12,
		borderWidth: 1,
		borderColor: "#e5e7eb",
		borderRadius: 6,
	},
	cardLabel: {
		fontSize: 8,
		color: "#6b7280",
		marginBottom: 3,
	},
	cardValue: {
		fontSize: 11,
		fontWeight: "bold",
		color: "#111827",
	},
	divider: {
		marginVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
	},
	tableHeader: {
		flexDirection: "row",
		backgroundColor: "#f3f4f6",
		borderTopLeftRadius: 6,
		borderTopRightRadius: 6,
		paddingVertical: 8,
		paddingHorizontal: 8,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 7,
		paddingHorizontal: 8,
		borderBottomWidth: 1,
		borderBottomColor: "#f3f4f6",
	},
	tableHeaderText: {
		fontSize: 8,
		fontWeight: "bold",
		color: "#374151",
	},
	tableText: {
		fontSize: 8,
		color: "#111827",
	},
	labelCol: {
		width: "44%",
	},
	qtyCol: {
		width: "14%",
		textAlign: "center",
	},
	unitCol: {
		width: "12%",
		textAlign: "center",
	},
	priceCol: {
		width: "15%",
		textAlign: "right",
	},
	totalCol: {
		width: "15%",
		textAlign: "right",
	},
	totals: {
		marginTop: 18,
		alignSelf: "flex-end",
		minWidth: 220,
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 6,
		backgroundColor: "#111827",
	},
	totalLabel: {
		fontSize: 10,
		fontWeight: "bold",
		color: "#ffffff",
	},
	totalValue: {
		fontSize: 10,
		fontWeight: "bold",
		color: "#ffffff",
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

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				<View style={styles.header}>
					<View>
						<Text style={styles.title}>{t("payments:receipt.pdf.title")}</Text>
						<Text style={styles.subtitle}>
							{t("payments:receipt.pdf.receiptNumber")} {receipt.receiptNumber}
						</Text>
					</View>
					<View>
						<Text style={styles.subtitle}>
							{t("payments:receipt.pdf.issuedAt")}{" "}
							{new Date(receipt.issuedAt).toLocaleString(locale)}
						</Text>
						<Text style={styles.subtitle}>
							{t("payments:receipt.pdf.paymentDate")}{" "}
							{new Date(receipt.paymentCreatedAt).toLocaleString(locale)}
						</Text>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>
						{t("payments:receipt.pdf.supplier")}
					</Text>
					<Text>{receipt.paymentReceiptSupplier.name}</Text>
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
					<Text>
						{resolveCountryLabel(
							t,
							receipt.paymentReceiptSupplierBillingInfo.countryCode,
						)}
					</Text>
					{receipt.paymentReceiptSupplierBillingInfoCz.identificationNumber && (
						<Text>
							{t("payments:receipt.pdf.identificationNumber")}{" "}
							{receipt.paymentReceiptSupplierBillingInfoCz.identificationNumber}
						</Text>
					)}
					{receipt.paymentReceiptSupplierBillingInfoCz.vatNumber && (
						<Text>
							{t("payments:receipt.pdf.vatNumber")}{" "}
							{receipt.paymentReceiptSupplierBillingInfoCz.vatNumber}
						</Text>
					)}
				</View>

				<View style={styles.grid}>
					<View style={styles.card}>
						<Text style={styles.cardLabel}>
							{t("payments:receipt.pdf.amountReceived")}
						</Text>
						<Text style={styles.cardValue}>
							{formatMoney(
								{
									value: receipt.totalAmount,
									currency: receipt.currency,
								},
								locale,
							)}
						</Text>
					</View>
					<View style={styles.card}>
						<Text style={styles.cardLabel}>
							{t("payments:receipt.pdf.itemCount")}
						</Text>
						<Text style={styles.cardValue}>
							{receipt.items.length.toLocaleString(locale)}
						</Text>
					</View>
				</View>

				<View style={styles.divider} />

				<View style={styles.tableHeader}>
					<Text style={[styles.tableHeaderText, styles.labelCol]}>
						{t("payments:receipt.pdf.columns.label")}
					</Text>
					<Text style={[styles.tableHeaderText, styles.qtyCol]}>
						{t("payments:receipt.pdf.columns.quantity")}
					</Text>
					<Text style={[styles.tableHeaderText, styles.unitCol]}>
						{t("payments:receipt.pdf.columns.unit")}
					</Text>
					<Text style={[styles.tableHeaderText, styles.priceCol]}>
						{t("payments:receipt.pdf.columns.unitPrice")}
					</Text>
					<Text style={[styles.tableHeaderText, styles.totalCol]}>
						{t("payments:receipt.pdf.columns.total")}
					</Text>
				</View>

				{receipt.items.map((line) => (
					<View key={line.id} style={styles.tableRow}>
						<Text style={[styles.tableText, styles.labelCol]}>
							{resolveLineLabel(t, line)}
						</Text>
						<Text style={[styles.tableText, styles.qtyCol]}>
							{line.quantity.toLocaleString(locale)}
						</Text>
						<Text style={[styles.tableText, styles.unitCol]}>
							{line.unitOfMeasure ?? "-"}
						</Text>
						<Text style={[styles.tableText, styles.priceCol]}>
							{formatMoney(
								{
									value: line.unitPrice,
									currency: receipt.currency,
								},
								locale,
							)}
						</Text>
						<Text style={[styles.tableText, styles.totalCol]}>
							{formatMoney(
								{
									value: line.totalAmount,
									currency: receipt.currency,
								},
								locale,
							)}
						</Text>
					</View>
				))}

				<View style={styles.totals}>
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
			</Page>
		</Document>
	);
};
