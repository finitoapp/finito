"use client";

import {
	createIdFromString,
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { PDFViewer, usePDF } from "@react-pdf/renderer";
import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
	CoinsIcon,
	EditIcon,
	FileCodeIcon,
	PrinterIcon,
	SendIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { QRCodeCanvas } from "qrcode.react";
import {
	type FC,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { InvoiceTemplate } from "@/components/invoices/invoice-cz";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import {
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { createQuery } from "@/lib/evolu";
import { type Invoice, InvoicePaymentMethod } from "@/lib/evolu/model/invoice";
import { InvoiceStatus } from "@/lib/evolu/model/invoice-status";
import { createIsdocXml } from "@/lib/invoice/isdoc";
import { generateCzechBankQrCode } from "@/lib/payment/czech-bank-qr-generator";
import { downloadFile } from "@/lib/shared/files/file-utils";
import { Integer } from "@/lib/shared/types";
import { formatIban, formatMoney } from "@/lib/shared/utils/format";

const StatusButton: FC<{
	invoiceId: Id;
}> = (props) => {
	const query = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("paymentWatchingState")
					.select("verifiedAt")
					.where("id", "=", props.invoiceId)
					.where("isDeleted", "is not", sqliteTrue)
					.limit(1),
			),
		[props.invoiceId],
	);
	const { data: invoiceStates } = useEvoluQuery(query);

	const invoiceStatus = invoiceStates ? invoiceStates[0] : undefined;
	const value =
		invoiceStatus && invoiceStatus.verifiedAt
			? InvoiceStatus.Paid
			: InvoiceStatus.Unpaid;

	const markAsPaid = async () => {
		// @TODO
		// evolu.upsert("invoiceStatus", {
		// 	id: props.invoiceId,
		// 	status: value === "unpaid" ? InvoiceStatus.Paid : InvoiceStatus.Unpaid,
		// });
	};

	return (
		<Button variant={"outline"} className={"w-full"} onClick={markAsPaid}>
			<CoinsIcon />
			{value === "unpaid" ? "Mark as paid" : "Remove payment"}
		</Button>
	);
};

const RawPdfGenerator = (props: {
	onGenerated: (params: {
		bytes: BlobPart[];
		mimetype: string;
		fileName: string;
	}) => void;
	invoice: Invoice;
	qrCodeSrc: string | null;
}) => {
	const [instance] = usePDF({
		document: (
			<InvoiceTemplate invoice={props.invoice} qrCodeSrc={props.qrCodeSrc} />
		),
	});

	const createInvoice = useEffectEvent(async (blob: Blob) => {
		const pdf = await PDFDocument.load(await blob.arrayBuffer());

		const isodoc = new Blob([createIsdocXml(props.invoice)], {
			type: "text/xml",
		});

		await pdf.attach(
			await isodoc.arrayBuffer(),
			`invoice-${props.invoice.invoiceNumber}.isdoc`,
			{
				mimeType: "text/xml",
				description: "ISDOC file",
			},
		);

		const updatedPdfBytes = (await pdf.save()) as BlobPart;

		props.onGenerated({
			bytes: [updatedPdfBytes],
			mimetype: "application/pdf'",
			fileName: `invoice-${props.invoice.invoiceNumber}.pdf`,
		});
	});

	useEffect(() => {
		if (instance.blob === null) {
			return;
		}

		void createInvoice(instance.blob);
	}, [instance.blob]);

	return null;
};

const QrCodeImageBuilder: FC<{
	qrCode: string;
	children: (imageData: string) => React.ReactNode;
}> = (props) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [qrUri, setQrUri] = useState<string | null>(null);

	useEffect(() => {
		if (canvasRef.current === null) {
			return;
		}

		const qrCodeDataUri = canvasRef.current.toDataURL("image/jpg", 0.3);
		setQrUri(qrCodeDataUri);
	}, []);

	return (
		<>
			<QRCodeCanvas
				ref={canvasRef}
				className={"hidden"}
				size={400}
				value={props.qrCode}
			/>
			{qrUri && props.children(qrUri)}
		</>
	);
};

const PDFGenerator = (props: {
	invoice: Invoice;
	paymentQrCode: string | null;
	onGenerated: (params: {
		bytes: BlobPart[];
		mimetype: string;
		fileName: string;
	}) => void;
}) => {
	return (
		<>
			{props.paymentQrCode ? (
				<QrCodeImageBuilder qrCode={props.paymentQrCode}>
					{(qrUri) => (
						<RawPdfGenerator
							qrCodeSrc={qrUri}
							invoice={props.invoice}
							onGenerated={props.onGenerated}
						/>
					)}
				</QrCodeImageBuilder>
			) : (
				<RawPdfGenerator
					qrCodeSrc={null}
					invoice={props.invoice}
					onGenerated={props.onGenerated}
				/>
			)}
		</>
	);
};

const DownloadPdf = (props: {
	invoice: Invoice;
	paymentQrCode: string | null;
}) => {
	const [isGenerating, setGenerating] = useState(false);

	return (
		<Button
			variant={"outline"}
			className={"w-full"}
			disabled={isGenerating}
			onClick={() => setGenerating(true)}
		>
			<PrinterIcon />
			{isGenerating ? "Downloading..." : "Download PDF"}
			{isGenerating && (
				<PDFGenerator
					invoice={props.invoice}
					paymentQrCode={props.paymentQrCode}
					onGenerated={async (params) => {
						await downloadFile(params);
						setGenerating(false);
					}}
				/>
			)}
		</Button>
	);
};

const SendPdf = (props: { invoice: Invoice; paymentQrCode: string | null }) => {
	const [isGenerating, setGenerating] = useState(false);
	const evolu = useEvolu();

	return (
		<Button
			variant={"outline"}
			className={"w-full"}
			disabled={isGenerating}
			onClick={() => setGenerating(true)}
		>
			<SendIcon />
			{isGenerating ? "Sending..." : "Send PDF invoice"}
			{isGenerating && (
				<PDFGenerator
					invoice={props.invoice}
					paymentQrCode={props.paymentQrCode}
					onGenerated={async (params) => {
						const customerEmail = props.invoice.invoiceCustomer.email;
						if (customerEmail === undefined) {
							return;
						}

						const [billingSettingsRows, smtpRows] = await Promise.all([
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
							(async () => {
								const query = createQuery((db) =>
									db
										.selectFrom("smtp")
										.selectAll()
										.where("isDeleted", "is not", sqliteTrue)
										.where("id", "=", createIdFromString("")),
								);
								return await evolu.loadQuery(query);
							})(),
						]);

						const smtp = smtpRows[0];
						if (smtp === undefined) {
							return;
						}

						const billingSettings = billingSettingsRows[0];
						if (
							billingSettings === undefined ||
							billingSettings.invoiceEmailSettingsEnable !== sqliteTrue
						) {
							return;
						}

						const reader = new FileReader();
						reader.onloadend = async () => {
							if (typeof reader.result !== "string") {
								return;
							}

							const base64data = reader.result.split(",")[1];

							await invoke("send_invoice", {
								server: smtp.server,
								port: smtp.port,
								username: smtp.username,
								password: smtp.password,
								from: smtp.name ? `${smtp.name} <${smtp.email}>` : smtp.email,
								to: `${props.invoice.invoiceCustomer.name} <${customerEmail}>`,
								subject: billingSettings.invoiceEmailSettingsSubject,
								body: billingSettings.invoiceEmailSettingsBody,
								attachmentName: params.fileName,
								attachmentMimetype: params.mimetype,
								attachment: base64data,
							});
							setGenerating(false);
						};
						reader.readAsDataURL(new Blob(params.bytes));
					}}
				/>
			)}
		</Button>
	);
};

const ISDOCGenerator = (props: { invoice: Invoice }) => {
	const download = async () => {
		await downloadFile({
			bytes: [createIsdocXml(props.invoice)],
			mimetype: "text/xml",
			fileName: `invoice-${props.invoice.invoiceNumber}.isdoc`,
		});
	};

	return (
		<Button variant={"outline"} className={"w-full"} onClick={download}>
			<FileCodeIcon />
			Download ISDOC
		</Button>
	);
};

export default function Home() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const invoiceQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("invoice")
					.select((eb) => [
						"invoice.id as id",
						"invoice.invoiceId as invoiceId",
						"invoice.invoiceNumber as invoiceNumber",
						"invoice.issueDate as issueDate",
						"invoice.dueDate as dueDate",
						"invoice.currency as currency",
						"invoice.paymentMethod as paymentMethod",
						"invoice.paymentIban as paymentIban",
						"invoice.createdAt as createdAt",

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceCustomer")
								.select([
									"invoiceCustomer.name as name",
									"invoiceCustomer.label as label",
									"invoiceCustomer.email as email",
									"invoiceCustomer.phone as phone",
								])
								.whereRef("invoiceCustomer.id", "=", "invoice.id")
								.where("invoiceCustomer.isDeleted", "is not", sqliteTrue)
								.where("invoiceCustomer.name", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
								}>(),
						).as("invoiceCustomer"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceCustomerBillingInfo")
								.select([
									"invoiceCustomerBillingInfo.countryCode as countryCode",
								])
								.whereRef("invoiceCustomerBillingInfo.id", "=", "invoice.id")
								.where(
									"invoiceCustomerBillingInfo.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where("invoiceCustomerBillingInfo.countryCode", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
									countryCode: KyselyNotNull;
								}>(),
						).as("invoiceCustomerBillingInfo"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceCustomerAddress")
								.select([
									"invoiceCustomerAddress.street as street",
									"invoiceCustomerAddress.descriptiveNumber as descriptiveNumber",
									"invoiceCustomerAddress.city as city",
									"invoiceCustomerAddress.postalCode as postalCode",
								])
								.whereRef("invoiceCustomerAddress.id", "=", "invoice.id")
								.where(
									"invoiceCustomerAddress.isDeleted",
									"is not",
									sqliteTrue,
								),
						).as("invoiceCustomerAddress"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceCustomerBillingInfoCz")
								.select([
									"invoiceCustomerBillingInfoCz.vatPayer as vatPayer",
									"invoiceCustomerBillingInfoCz.identificationNumber as identificationNumber",
									"invoiceCustomerBillingInfoCz.vatNumber as vatNumber",
									"invoiceCustomerBillingInfoCz.caseNumber as caseNumber",
								])
								.whereRef("invoiceCustomerBillingInfoCz.id", "=", "invoice.id")
								.where(
									"invoiceCustomerBillingInfoCz.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where(
									"invoiceCustomerBillingInfoCz.identificationNumber",
									"is not",
									null,
								)
								.$narrowType<{
									vatPayer: KyselyNotNull;
									identificationNumber: KyselyNotNull;
								}>(),
						).as("invoiceCustomerBillingInfoCz"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceSupplier")
								.select([
									"invoiceSupplier.name as name",
									"invoiceSupplier.label as label",
									"invoiceSupplier.email as email",
									"invoiceSupplier.phone as phone",
								])
								.whereRef("invoiceSupplier.id", "=", "invoice.id")
								.where("invoiceSupplier.isDeleted", "is not", sqliteTrue)
								.where("invoiceSupplier.name", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
								}>(),
						).as("invoiceSupplier"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceSupplierBillingInfo")
								.select([
									"invoiceSupplierBillingInfo.countryCode as countryCode",
								])
								.whereRef("invoiceSupplierBillingInfo.id", "=", "invoice.id")
								.where(
									"invoiceSupplierBillingInfo.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where("invoiceSupplierBillingInfo.countryCode", "is not", null)
								.$narrowType<{
									countryCode: KyselyNotNull;
								}>(),
						).as("invoiceSupplierBillingInfo"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceSupplierAddress")
								.select([
									"invoiceSupplierAddress.street as street",
									"invoiceSupplierAddress.descriptiveNumber as descriptiveNumber",
									"invoiceSupplierAddress.city as city",
									"invoiceSupplierAddress.postalCode as postalCode",
								])
								.whereRef("invoiceSupplierAddress.id", "=", "invoice.id")
								.where(
									"invoiceSupplierAddress.isDeleted",
									"is not",
									sqliteTrue,
								),
						).as("invoiceSupplierAddress"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceSupplierBillingInfoCz")
								.select([
									"invoiceSupplierBillingInfoCz.vatPayer as vatPayer",
									"invoiceSupplierBillingInfoCz.identificationNumber as identificationNumber",
									"invoiceSupplierBillingInfoCz.vatNumber as vatNumber",
									"invoiceSupplierBillingInfoCz.caseNumber as caseNumber",
								])
								.whereRef("invoiceSupplierBillingInfoCz.id", "=", "invoice.id")
								.where(
									"invoiceSupplierBillingInfoCz.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where(
									"invoiceSupplierBillingInfoCz.identificationNumber",
									"is not",
									null,
								)
								.$narrowType<{
									vatPayer: KyselyNotNull;
									identificationNumber: KyselyNotNull;
								}>(),
						).as("invoiceSupplierBillingInfoCz"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("paymentWatchingState")
								.select(["paymentWatchingState.verifiedAt as verifiedAt"])
								.whereRef("paymentWatchingState.id", "=", "invoice.id")
								.where("paymentWatchingState.isDeleted", "is not", sqliteTrue),
						).as("paymentWatchingState"),

						evoluJsonArrayFrom(
							eb
								.selectFrom("invoiceItemLine")
								.select(
									(eb) =>
										[
											"invoiceItemLine.id as id",
											"invoiceItemLine.quantity as quantity",
											"invoiceItemLine.totalAmount as totalAmount",

											evoluJsonObjectFrom(
												eb
													.selectFrom("itemRevision")
													.select([
														"itemRevision.id as id",
														"itemRevision.deviceId as deviceId",
														"itemRevision.categoryId as categoryId",
														"itemRevision.itemId as itemId",
														"itemRevision.label as label",
														"itemRevision.price as price",
														"itemRevision.currency as currency",
														"itemRevision.unitOfMeasure as unitOfMeasure",
														"itemRevision.internalCode as internalCode",
														"itemRevision.productCodeType as productCodeType",
														"itemRevision.productCodeValue as productCodeValue",
													])
													.whereRef(
														"itemRevision.id",
														"=",
														"invoiceItemLine.itemRevisionId",
													)
													.where("itemRevision.isDeleted", "is not", sqliteTrue)
													.where("itemRevision.label", "is not", null)
													.where("itemRevision.price", "is not", null)
													.where("itemRevision.currency", "is not", null)
													.$narrowType<{
														label: KyselyNotNull;
														price: KyselyNotNull;
														currency: KyselyNotNull;
													}>(),
											).as("item"),
										] as const,
								)
								.whereRef("invoiceItemLine.invoiceId", "=", "invoice.id")
								.where("invoiceItemLine.isDeleted", "is not", sqliteTrue)
								.where("invoiceItemLine.totalAmount", "is not", null)
								.where("invoiceItemLine.quantity", "is not", null)
								.$narrowType<{
									quantity: KyselyNotNull;
									totalAmount: KyselyNotNull;
									item: KyselyNotNull;
								}>(),
						).as("items"),
					])
					.where("invoice.id", "=", id as Id)
					.where("invoice.isDeleted", "is not", sqliteTrue)
					.where("invoice.invoiceId", "is not", null)
					.where("invoice.invoiceNumber", "is not", null)
					.where("invoice.issueDate", "is not", null)
					.where("invoice.dueDate", "is not", null)
					.where("invoice.currency", "is not", null)
					.where("invoice.paymentMethod", "is not", null)
					.$narrowType<{
						items: KyselyNotNull;
						invoiceId: KyselyNotNull;
						invoiceNumber: KyselyNotNull;
						issueDate: KyselyNotNull;
						dueDate: KyselyNotNull;
						currency: KyselyNotNull;
						paymentMethod: KyselyNotNull;
						invoiceSupplier: KyselyNotNull;
						invoiceSupplierBillingInfo: KyselyNotNull;
						invoiceSupplierAddress: KyselyNotNull;
						invoiceSupplierBillingInfoCz: KyselyNotNull;
						invoiceCustomer: KyselyNotNull;
						invoiceCustomerBillingInfo: KyselyNotNull;
						invoiceCustomerAddress: KyselyNotNull;
						invoiceCustomerBillingInfoCz: KyselyNotNull;
					}>(),
			),
		[id],
	);

	const { data: invoiceRows } = useEvoluQuery(invoiceQuery);
	const invoice = invoiceRows[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (invoice === undefined) {
				return;
			}

			evolu.update("invoice", {
				id: invoice.id,
				isDeleted: sqliteTrue,
			});
			router.push("/admin/invoices");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteItem();
		},
		{
			title: "Delete invoice?",
			description: "This action cannot be undone.",
			confirmText: "Delete",
			cancelText: "Cancel",
			confirmVariant: "destructive",
		},
	);

	const totalAmount = invoice
		? invoice.items.reduce((acc, value) => acc + value.totalAmount, 0)
		: 0;

	const paymentQrCode =
		invoice &&
		invoice.paymentMethod === InvoicePaymentMethod.BankTransfer &&
		invoice.paymentIban &&
		totalAmount > 0 &&
		invoice.paymentIban.startsWith("CZ")
			? generateCzechBankQrCode({
					amount: totalAmount,
					currency: invoice.currency,
					iban: invoice.paymentIban,
					variableSymbol: invoice.invoiceNumber,
				})
			: null;

	useEffect(() => {
		if (invoice === undefined) {
			router.replace("/admin/invoices");
		}
	}, [invoice, router]);

	if (invoice === undefined) {
		return null;
	}

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<div className={"flex flex-2 gap-4 flex-col"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>{invoice.invoiceNumber}</CardTitle>
							<CardAction>
								{/*{item && (*/}
								{/*	<InvoiceStatusBadge*/}
								{/*		invoiceId={item.id}*/}
								{/*		dueDate={new Date(item.dueDate)}*/}
								{/*	/>*/}
								{/*)}*/}
							</CardAction>
						</CardHeader>
						<CardContent>
							<div className={"flex flex-wrap flex-col gap-8"}>
								<div className={"flex gap-4"}>
									<StaticCard
										title={"Price"}
										content={formatMoney({
											value: Integer(
												invoice.items.reduce(
													(acc, value) => acc + value.totalAmount,
													0,
												),
											),
											currency: invoice.currency,
										})}
										className={"flex-1"}
									/>

									<StaticCard
										title={"Modified at"}
										content={new Date(invoice.createdAt).toLocaleDateString()}
										footer={new Date(invoice.createdAt).toLocaleTimeString()}
										className={"flex-1"}
									/>
								</div>
								<div className={"flex gap-4"}>
									<StaticCard
										title={"Issue date"}
										content={new Date(invoice.issueDate).toLocaleDateString()}
										className={"flex-1"}
									/>

									<StaticCard
										title={"Due date"}
										content={new Date(invoice.dueDate).toLocaleDateString()}
										className={"flex-1"}
									/>
								</div>

								<div className={"flex flex-wrap gap-8"}>
									<div className={"flex-1"}>
										<KeyValueList
											items={[
												{
													key: "Invoice number",
													value: invoice.invoiceNumber ?? "-",
												},
												{
													key: "Price",
													value: formatMoney({
														value: Integer(
															invoice.items.reduce(
																(acc, value) => acc + value.totalAmount,
																0,
															),
														),
														currency: invoice.currency,
													}),
												},
												{
													key: "Name",
													value: invoice.invoiceSupplier.name ?? "-",
												},
												{
													key: "VAT Number",
													value:
														(invoice.invoiceSupplierBillingInfoCz &&
															invoice.invoiceSupplierBillingInfoCz.vatNumber) ??
														"-",
												},
												{
													key: "Payment Method",
													value: invoice.paymentMethod,
												},
												...(invoice.paymentMethod ===
												InvoicePaymentMethod.BankTransfer
													? [
															{
																key: "IBAN",
																value: invoice.paymentIban
																	? formatIban(invoice.paymentIban)
																	: "-",
															},
														]
													: []),
												{
													key: "E-mail",
													value: invoice.invoiceSupplier.email ?? "-",
												},
												{
													key: "Phone",
													value: invoice.invoiceSupplier.phone ?? "-",
												},
												{
													key: "Street",
													value: invoice.invoiceSupplierAddress.street ?? "-",
												},
												{
													key: "City",
													value: invoice.invoiceSupplierAddress.city ?? "-",
												},
												{
													key: "Postal Code",
													value:
														invoice.invoiceSupplierAddress.postalCode ?? "-",
												},
												{
													key: "Country",
													value:
														invoice.invoiceSupplierBillingInfo.countryCode ??
														"-",
												},
											]}
										/>
									</div>
									<div className={"flex-1"}>
										<KeyValueList
											items={[
												{
													key: "Customer",
													value: invoice.invoiceCustomer.name ?? "-",
												},
												{
													key: "VAT Number",
													value:
														(invoice.invoiceCustomerBillingInfoCz &&
															invoice.invoiceCustomerBillingInfoCz.vatNumber) ??
														"-",
												},
												{
													key: "Identification Number",
													value:
														(invoice.invoiceCustomerBillingInfoCz &&
															invoice.invoiceCustomerBillingInfoCz
																.identificationNumber) ??
														"-",
												},
												{
													key: "E-mail",
													value: invoice.invoiceCustomer.email ?? "-",
												},
												{
													key: "Phone",
													value: invoice.invoiceCustomer.phone ?? "-",
												},
												{
													key: "Street",
													value: invoice.invoiceCustomerAddress.street ?? "-",
												},
												{
													key: "City",
													value: invoice.invoiceCustomerAddress.city ?? "-",
												},
												{
													key: "Postal Code",
													value:
														invoice.invoiceCustomerAddress.postalCode ?? "-",
												},
												{
													key: "Country",
													value:
														invoice.invoiceCustomerBillingInfo.countryCode ??
														"-",
												},
											]}
										/>
									</div>
								</div>
							</div>
						</CardContent>
					</ResponsiveCard>
				</div>

				<div className={"flex-1 flex flex-col gap-4"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>{t("common:table.actions")}</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							<DownloadPdf invoice={invoice} paymentQrCode={paymentQrCode} />
							<SendPdf invoice={invoice} paymentQrCode={paymentQrCode} />
							<ISDOCGenerator invoice={invoice} />
							<Button
								variant={"outline"}
								className={"w-full"}
								render={
									<Link
										href={`/admin/invoices/edit?id=${encodeURIComponent(id)}`}
									/>
								}
							>
								<EditIcon />
								Edit
							</Button>
							{<StatusButton invoiceId={invoice.id} />}
							<Button className={"w-full"} onClick={() => void onDelete()}>
								<Trash2Icon />
								Delete
							</Button>
						</CardContent>
					</ResponsiveCard>

					<ResponsiveCard>
						<CardHeader>
							<CardTitle>{t("invoices:page.pdfInvoicePreview")}</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							{paymentQrCode ? (
								<QrCodeImageBuilder qrCode={paymentQrCode}>
									{(qrUri) => (
										<PDFViewer width={"100%"} height={600} showToolbar={false}>
											<InvoiceTemplate qrCodeSrc={qrUri} invoice={invoice} />
										</PDFViewer>
									)}
								</QrCodeImageBuilder>
							) : (
								<PDFViewer width={"100%"} height={600} showToolbar={false}>
									<InvoiceTemplate invoice={invoice} qrCodeSrc={null} />
								</PDFViewer>
							)}
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}
