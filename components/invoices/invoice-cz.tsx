"use client";

import { useTranslation } from "react-i18next";
import {
	Document,
	Font,
	Image,
	Page,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import type React from "react";
import { formatAmount, formatIban } from "@/lib/shared/utils/format";
import { parseCzechBankAccountFromIban } from "@/lib/shared/utils/iban";
import { CountryCode } from "@/lib/shared/types";
import { type Invoice, InvoicePaymentMethod } from "@/lib/evolu/model/invoice";

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
		flexDirection: "column",
		backgroundColor: "#ffffff",
		padding: 40,
		fontFamily: "Roboto",
		fontSize: 8,
		lineHeight: 1.4,
	},
	line: {
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		marginVertical: 12,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
	},
	title: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#1f2937",
		marginBottom: 10,
	},
	invoiceNumber: {
		fontSize: 12,
		color: "#6b7280",
	},
	dateInfo: {
		fontSize: 8,
		color: "#6b7280",
		textAlign: "right",
	},
	companyInfo: {
		flexDirection: "column",
		textAlign: "right",
	},
	companyName: {
		fontSize: 8,
		fontWeight: "bold",
		color: "#1f2937",
	},
	billToSection: {
		flexDirection: "column",
	},
	sectionTitle: {
		fontSize: 7,
		fontWeight: "bold",
		color: "#374151",
		marginBottom: 4,
		letterSpacing: 0.5,
	},
	table: {
		marginBottom: 14,
		borderRadius: 6,
	},
	tableHeader: {
		borderTopLeftRadius: 6,
		borderTopRightRadius: 6,
		flexDirection: "row",
		backgroundColor: "#f9fafb",
		paddingTop: 6,
		paddingBottom: 2,
		paddingHorizontal: 6,
		borderBottomWidth: 1,
		borderColor: "#e5e7eb",
	},
	tableHeaderText: {
		fontSize: 7,
		fontWeight: "bold",
		color: "#374151",
		letterSpacing: 0.5,
	},
	tableRow: {
		flexDirection: "row",
		paddingTop: 4,
		paddingBottom: 2,
		paddingHorizontal: 5,
		borderBottomWidth: 1,
		borderBottomColor: "#f3f4f6",
	},
	tableRowEven: {
		backgroundColor: "#fafafa",
	},
	tableCell: {
		fontSize: 7,
		color: "#1f2937",
	},
	tableCellRight: {
		textAlign: "right",
	},
	descriptionCol: {
		width: "55%",
	},
	quantityCol: {
		width: "12%",
		textAlign: "center",
	},
	unitCol: {
		width: "7%",
		textAlign: "center",
	},
	rateCol: {
		width: "13%",
		textAlign: "right",
	},
	amountCol: {
		width: "13%",
		textAlign: "right",
	},
	totalsSection: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 30,
	},
	totalsTable: {
		width: "60%",
		minWidth: 200,
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 6,
		paddingHorizontal: 15,
	},
	totalRowFinal: {
		backgroundColor: "#1f2937",
		paddingVertical: 10,
		borderRadius: 4,
	},
	totalLabel: {
		fontSize: 9,
		color: "#6b7280",
	},
	totalValue: {
		fontSize: 9,
		color: "#1f2937",
		fontWeight: "bold",
	},
	totalLabelFinal: {
		fontSize: 10,
		color: "#ffffff",
		fontWeight: "bold",
	},
	totalValueFinal: {
		fontSize: 10,
		color: "#ffffff",
		fontWeight: "bold",
	},
	notesSection: {
		marginTop: 20,
		paddingTop: 20,
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
	},
	notesTitle: {
		fontSize: 10,
		fontWeight: "bold",
		color: "#374151",
		marginBottom: 8,
	},
	notesText: {
		fontSize: 8,
		color: "#6b7280",
		lineHeight: 1.6,
	},
	footer: {
		position: "absolute",
		bottom: 30,
		left: 40,
		right: 40,
		textAlign: "center",
		fontSize: 6,
		color: "#9ca3af",
		borderTopWidth: 1,
		borderTopColor: "#f3f4f6",
		paddingTop: 15,
	},
});

export const InvoiceTemplate: React.FC<{
	invoice: Invoice;
	qrCodeSrc: string | null;
}> = ({ invoice, qrCodeSrc }) => {
	const { t } = useTranslation();
	const czechBankAccountNumber =
		invoice.payment.method === InvoicePaymentMethod.BankTransfer
			? parseCzechBankAccountFromIban(invoice.payment.iban)
			: null;

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<View style={{ width: "50%" }}>
						<Text style={styles.title}>{t("invoices:pdf.cz.faktura")}</Text>
						<Text style={styles.invoiceNumber}>č. {invoice.invoiceNumber}</Text>
					</View>
				</View>

				<View style={styles.line}></View>

				<View style={{ flexDirection: "row" }}>
					<View style={{ width: "60%", paddingRight: 20 }}>
						<View style={styles.billToSection}>
							<Text style={styles.sectionTitle}>{t("invoices:pdf.cz.dodavatel")}</Text>
							<Text style={styles.companyName}>
								{invoice.supplier.billingInfo.name}
							</Text>
							<Text>
								{invoice.supplier.billingInfo.address.street}{" "}
								{invoice.supplier.billingInfo.address.descriptiveNumber}
							</Text>
							<Text>
								{invoice.supplier.billingInfo.address.postalCode},{" "}
								{invoice.supplier.billingInfo.address.city}
							</Text>
							<Text>
								{
									{
										[CountryCode.CZ]: "Česká republika",
									}[invoice.supplier.billingInfo.countrySpecific.countryCode]
								}
							</Text>
							<View style={{ height: 6, width: "100%" }}></View>
							{invoice.supplier.billingInfo.countrySpecific
								.identificationNumber && (
								<Text>
									IČO:{" "}
									{
										invoice.supplier.billingInfo.countrySpecific
											.identificationNumber
									}
								</Text>
							)}
							{invoice.supplier.billingInfo.countrySpecific.vatPayer ? (
								<Text>
									DIČ: {invoice.supplier.billingInfo.countrySpecific.vatNumber}
								</Text>
							) : (
								<Text>{t("invoices:pdf.cz.neplatceDph")}</Text>
							)}
							<View style={{ height: 6, width: "100%" }}></View>
							{invoice.supplier.billingInfo.email && (
								<Text>E-mail: {invoice.supplier.billingInfo.email}</Text>
							)}
						</View>
					</View>
					<View style={{ width: "40%" }}>
						<View style={styles.billToSection}>
							<Text style={styles.sectionTitle}>{t("invoices:pdf.cz.odberatel")}</Text>
							<Text style={styles.companyName}>
								{invoice.customer.billingInfo.name}
							</Text>
							<Text>
								{invoice.customer.billingInfo.address.street}{" "}
								{invoice.customer.billingInfo.address.descriptiveNumber}
							</Text>
							<Text>
								{invoice.customer.billingInfo.address.postalCode},{" "}
								{invoice.customer.billingInfo.address.city}
							</Text>
							<Text>
								{
									{
										[CountryCode.CZ]: "Česká republika",
									}[invoice.customer.billingInfo.countrySpecific.countryCode]
								}
							</Text>
							<View style={{ height: 6, width: "100%" }}></View>
							{invoice.customer.billingInfo.countrySpecific
								.identificationNumber && (
								<Text>
									IČO:{" "}
									{
										invoice.customer.billingInfo.countrySpecific
											.identificationNumber
									}
								</Text>
							)}
							{invoice.customer.billingInfo.countrySpecific.vatNumber && (
								<Text>
									DIČ: {invoice.customer.billingInfo.countrySpecific.vatNumber}
								</Text>
							)}
							{invoice.customer.billingInfo.email && (
								<Text>E-mail: {invoice.customer.billingInfo.email}</Text>
							)}
						</View>
					</View>
				</View>

				<View style={styles.line}></View>

				<View style={{ flexDirection: "row", marginBottom: 15, width: "100%" }}>
					<View style={{ width: "50%" }}>
						<View style={{ flexDirection: "row", width: "100%" }}>
							<View style={{ width: "50%" }}>
								<Text style={styles.dateInfo}>{t("invoices:pdf.cz.zpusobUhrady")}</Text>
							</View>
							<View style={{ width: "50%", paddingLeft: 8 }}>
								<Text>
									{
										{
											[InvoicePaymentMethod.BankTransfer]: "Převodem",
											[InvoicePaymentMethod.PaymentCard]: "Platební kartou",
											[InvoicePaymentMethod.Cash]: "Hotově",
										}[invoice.payment.method]
									}
								</Text>
							</View>
						</View>

						{invoice.payment.method === InvoicePaymentMethod.BankTransfer && (
							<>
								{czechBankAccountNumber && (
									<View
										style={{
											flexDirection: "row",
											width: "100%",
											fontWeight: "bold",
										}}
									>
										<View style={{ width: "50%" }}>
											<Text style={styles.dateInfo}>{t("invoices:pdf.cz.cisloUctu")}</Text>
										</View>
										<View
											style={{
												width: "50%",
												paddingLeft: 8,
												flexDirection: "row",
											}}
										>
											<Text>{czechBankAccountNumber}</Text>
										</View>
									</View>
								)}
								<View
									style={{
										flexDirection: "row",
										width: "100%",
										fontWeight: "bold",
									}}
								>
									<View style={{ width: "50%" }}>
										<Text style={styles.dateInfo}>{t("invoices:pdf.cz.variabilniSymbol")}</Text>
									</View>
									<View style={{ width: "50%", paddingLeft: 8 }}>
										<Text>{invoice.invoiceNumber}</Text>
									</View>
								</View>
								<View
									style={{
										flexDirection: "row",
										width: "100%",
									}}
								>
									<View style={{ width: "50%" }}>
										<Text style={styles.dateInfo}>{t("invoices:pdf.cz.iban")}</Text>
									</View>
									<View style={{ width: "50%", paddingLeft: 8 }}>
										<Text>{formatIban(invoice.payment.iban)}</Text>
									</View>
								</View>
							</>
						)}
					</View>
					<View style={{ width: "50%" }}>
						<View style={{ flexDirection: "row", width: "100%" }}>
							<View style={{ width: "50%" }}>
								<Text style={styles.dateInfo}>{t("invoices:pdf.cz.datumVystaveni")}</Text>
							</View>
							<View style={{ width: "50%", paddingLeft: 8 }}>
								<Text>
									{new Date(invoice.issueDate).toLocaleDateString("cs")}
								</Text>
							</View>
						</View>
						<View
							style={{
								flexDirection: "row",
								width: "100%",
								fontWeight: "bold",
							}}
						>
							<View style={{ width: "50%" }}>
								<Text style={styles.dateInfo}>{t("invoices:pdf.cz.datumSplatnosti")}</Text>
							</View>
							<View style={{ width: "50%", paddingLeft: 8 }}>
								<Text>
									{new Date(invoice.dueDate).toLocaleDateString("cs")}
								</Text>
							</View>
						</View>
					</View>
				</View>

				{/* Items Table */}
				<View style={styles.table}>
					<View style={styles.tableHeader}>
						<Text style={[styles.tableHeaderText, styles.descriptionCol]}>
							Označení dodávky
						</Text>
						<Text style={[styles.tableHeaderText, styles.quantityCol]}>
							Počet
						</Text>
						<Text style={[styles.tableHeaderText, styles.unitCol]}>{t("invoices:pdf.cz.mj")}</Text>
						<Text style={[styles.tableHeaderText, styles.rateCol]}>
							Cena za M.J.
						</Text>
						<Text style={[styles.tableHeaderText, styles.amountCol]}>
							Celkem
						</Text>
					</View>

					{invoice.items.map((item, index) => (
						<View
							// biome-ignore lint/suspicious/noArrayIndexKey: eit's ok
							key={index}
							style={[
								styles.tableRow,
								index % 2 === 1 ? styles.tableRowEven : {},
							]}
						>
							<Text style={[styles.tableCell, styles.descriptionCol]}>
								{item.label}
							</Text>
							<Text style={[styles.tableCell, styles.quantityCol]}>
								{item.quantity}
							</Text>
							<Text style={[styles.tableCell, styles.unitCol]}>
								{item.unitOfMeasure}
							</Text>
							<Text style={[styles.tableCell, styles.rateCol]}>
								{formatAmount(item.price, invoice.currency, "cs")}
							</Text>
							<Text style={[styles.tableCell, styles.amountCol]}>
								{formatAmount(
									item.price * item.quantity,
									invoice.currency,
									"cs",
								)}
							</Text>
						</View>
					))}
				</View>

				{/* Totals */}
				<View style={styles.totalsSection}>
					<View
						style={{
							width: "40%",
							height: 200,
						}}
					>
						{qrCodeSrc && (
							<View
								style={{
									padding: 10,
									borderColor: "#e5e7eb",
									borderWidth: "1px",
									borderRadius: 4,
									width: 120,
									height: 120,
								}}
							>
								<Image
									src={qrCodeSrc}
									style={{ width: "100%", height: "100%" }}
								/>
								<Text
									style={{
										position: "absolute",
										bottom: "-12px",
										left: "5px",
										backgroundColor: "white",
										paddingHorizontal: 10,
										paddingVertical: 4,
										color: "#374151",
									}}
								>
									QR Platba
								</Text>
							</View>
						)}
					</View>
					<View style={styles.totalsTable}>
						<View style={[styles.totalRow, styles.totalRowFinal]}>
							<Text style={styles.totalLabelFinal}>{t("invoices:pdf.cz.celkemKUhrade")}</Text>
							<Text style={styles.totalValueFinal}>
								{formatAmount(
									invoice.items.reduce(
										(acc, value) => acc + value.price * value.quantity,
										0,
									),
									invoice.currency,
									"cs",
								)}
							</Text>
						</View>
					</View>
				</View>

				{/* Notes */}
				<View style={styles.notesSection}>
					<Text style={styles.notesTitle}>{t("invoices:pdf.cz.poznamka")}</Text>
					<Text style={styles.notesText}>{t("invoices:pdf.cz.dekujemeVamZaSpolupraci")}</Text>
				</View>

				{/* Footer */}
				<Text style={styles.footer}>
					{invoice.supplier.billingInfo.countrySpecific.caseNumber && (
						<>{invoice.supplier.billingInfo.countrySpecific.caseNumber} • </>
					)}
					{invoice.supplier.billingInfo.name} •{" "}
					{invoice.supplier.billingInfo.email}
				</Text>
			</Page>
		</Document>
	);
};
