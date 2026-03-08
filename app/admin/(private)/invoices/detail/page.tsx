"use client";

import { createIdFromString, type Id, kysely, sqliteTrue } from "@evolu/common";
import { PDFViewer, usePDF } from "@react-pdf/renderer";
import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { NotNull } from "kysely";
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
	CardContent,
	CardHeader,
	CardTitle,
	CardToolbar,
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
	const _evolu = useEvolu();
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
						const customerEmail =
							props.invoice.invoiceCustomerBillingInfo.email;
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
								to: `${props.invoice.invoiceCustomerBillingInfo.name} <${customerEmail}>`,
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

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("invoiceCustomerBillingInfo")
									.select([
										"invoiceCustomerBillingInfo.name as name",
										"invoiceCustomerBillingInfo.label as label",
										"invoiceCustomerBillingInfo.email as email",
										"invoiceCustomerBillingInfo.countryCode as countryCode",
									])
									.whereRef("invoiceCustomerBillingInfo.id", "=", "invoice.id")
									.where(
										"invoiceCustomerBillingInfo.isDeleted",
										"is not",
										sqliteTrue,
									)
									.where("invoiceCustomerBillingInfo.name", "is not", null)
									.where(
										"invoiceCustomerBillingInfo.countryCode",
										"is not",
										null,
									)
									.$narrowType<{
										name: NotNull;
										countryCode: NotNull;
									}>(),
							)
							.as("invoiceCustomerBillingInfo"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("invoiceCustomerBillingInfoAddress")
									.select([
										"invoiceCustomerBillingInfoAddress.street as street",
										"invoiceCustomerBillingInfoAddress.descriptiveNumber as descriptiveNumber",
										"invoiceCustomerBillingInfoAddress.city as city",
										"invoiceCustomerBillingInfoAddress.postalCode as postalCode",
									])
									.whereRef(
										"invoiceCustomerBillingInfoAddress.id",
										"=",
										"invoice.id",
									)
									.where(
										"invoiceCustomerBillingInfoAddress.isDeleted",
										"is not",
										sqliteTrue,
									),
							)
							.as("invoiceCustomerBillingInfoAddress"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("invoiceCustomerBillingInfoCz")
									.select([
										"invoiceCustomerBillingInfoCz.vatPayer as vatPayer",
										"invoiceCustomerBillingInfoCz.identificationNumber as identificationNumber",
										"invoiceCustomerBillingInfoCz.vatNumber as vatNumber",
										"invoiceCustomerBillingInfoCz.caseNumber as caseNumber",
									])
									.whereRef(
										"invoiceCustomerBillingInfoCz.id",
										"=",
										"invoice.id",
									)
									.where(
										"invoiceCustomerBillingInfoCz.isDeleted",
										"is not",
										sqliteTrue,
									)
									.where(
										"invoiceCustomerBillingInfoCz.vatPayer",
										"is not",
										null,
									)
									.where(
										"invoiceCustomerBillingInfoCz.identificationNumber",
										"is not",
										null,
									)
									.$narrowType<{
										vatPayer: NotNull;
										identificationNumber: NotNull;
									}>(),
							)
							.as("invoiceCustomerBillingInfoCz"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("invoiceSupplierBillingInfo")
									.select([
										"invoiceSupplierBillingInfo.name as name",
										"invoiceSupplierBillingInfo.label as label",
										"invoiceSupplierBillingInfo.email as email",
										"invoiceSupplierBillingInfo.countryCode as countryCode",
									])
									.whereRef("invoiceSupplierBillingInfo.id", "=", "invoice.id")
									.where(
										"invoiceSupplierBillingInfo.isDeleted",
										"is not",
										sqliteTrue,
									)
									.where("invoiceSupplierBillingInfo.name", "is not", null)
									.where(
										"invoiceSupplierBillingInfo.countryCode",
										"is not",
										null,
									)
									.$narrowType<{
										name: NotNull;
										countryCode: NotNull;
									}>(),
							)
							.as("invoiceSupplierBillingInfo"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("invoiceSupplierBillingInfoAddress")
									.select([
										"invoiceSupplierBillingInfoAddress.street as street",
										"invoiceSupplierBillingInfoAddress.descriptiveNumber as descriptiveNumber",
										"invoiceSupplierBillingInfoAddress.city as city",
										"invoiceSupplierBillingInfoAddress.postalCode as postalCode",
									])
									.whereRef(
										"invoiceSupplierBillingInfoAddress.id",
										"=",
										"invoice.id",
									)
									.where(
										"invoiceSupplierBillingInfoAddress.isDeleted",
										"is not",
										sqliteTrue,
									),
							)
							.as("invoiceSupplierBillingInfoAddress"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("invoiceSupplierBillingInfoCz")
									.select([
										"invoiceSupplierBillingInfoCz.vatPayer as vatPayer",
										"invoiceSupplierBillingInfoCz.identificationNumber as identificationNumber",
										"invoiceSupplierBillingInfoCz.vatNumber as vatNumber",
										"invoiceSupplierBillingInfoCz.caseNumber as caseNumber",
									])
									.whereRef(
										"invoiceSupplierBillingInfoCz.id",
										"=",
										"invoice.id",
									)
									.where(
										"invoiceSupplierBillingInfoCz.isDeleted",
										"is not",
										sqliteTrue,
									)
									.where(
										"invoiceSupplierBillingInfoCz.vatPayer",
										"is not",
										null,
									)
									.where(
										"invoiceSupplierBillingInfoCz.identificationNumber",
										"is not",
										null,
									)
									.$narrowType<{
										vatPayer: NotNull;
										identificationNumber: NotNull;
									}>(),
							)
							.as("invoiceSupplierBillingInfoCz"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("paymentWatchingState")
									.select(["paymentWatchingState.verifiedAt as verifiedAt"])
									.whereRef("paymentWatchingState.id", "=", "invoice.id")
									.where(
										"paymentWatchingState.isDeleted",
										"is not",
										sqliteTrue,
									),
							)
							.as("paymentWatchingState"),

						kysely
							.jsonArrayFrom(
								eb
									.selectFrom("invoiceItemLine")
									.select(
										(eb) =>
											[
												"invoiceItemLine.id as id",
												"invoiceItemLine.quantity as quantity",
												"invoiceItemLine.totalAmount as totalAmount",

												kysely
													.jsonObjectFrom(
														eb
															.selectFrom("invoiceItem")
															.select([
																"invoiceItem.id as id",
																"invoiceItem.categoryId as categoryId",
																"invoiceItem.sourceItemId as sourceItemId",
																"invoiceItem.label as label",
																"invoiceItem.price as price",
																"invoiceItem.currency as currency",
																"invoiceItem.unitOfMeasure as unitOfMeasure",
																"invoiceItem.internalCode as internalCode",
																"invoiceItem.productCodeType as productCodeType",
																"invoiceItem.productCodeValue as productCodeValue",
															])
															.whereRef(
																"invoiceItem.id",
																"=",
																"invoiceItemLine.id",
															)
															.where(
																"invoiceItem.isDeleted",
																"is not",
																sqliteTrue,
															)
															.where("invoiceItem.label", "is not", null)
															.where("invoiceItem.price", "is not", null)
															.where("invoiceItem.currency", "is not", null)
															.$narrowType<{
																label: NotNull;
																price: NotNull;
																currency: NotNull;
															}>(),
													)
													.as("item"),
											] as const,
									)
									.whereRef("invoiceItemLine.invoiceId", "=", "invoice.id")
									.where("invoiceItemLine.isDeleted", "is not", sqliteTrue)
									.where("invoiceItemLine.totalAmount", "is not", null)
									.where("invoiceItemLine.quantity", "is not", null)
									.$narrowType<{
										quantity: NotNull;
										totalAmount: NotNull;
										item: NotNull;
									}>(),
							)
							.as("items"),
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
						items: NotNull;
						invoiceId: NotNull;
						invoiceNumber: NotNull;
						issueDate: NotNull;
						dueDate: NotNull;
						currency: NotNull;
						paymentMethod: NotNull;
						invoiceSupplierBillingInfo: NotNull;
						invoiceSupplierBillingInfoAddress: NotNull;
						invoiceSupplierBillingInfoCz: NotNull;
						invoiceCustomerBillingInfo: NotNull;
						invoiceCustomerBillingInfoAddress: NotNull;
						invoiceCustomerBillingInfoCz: NotNull;
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
							<CardToolbar>
								{/*{item && (*/}
								{/*	<InvoiceStatusBadge*/}
								{/*		invoiceId={item.id}*/}
								{/*		dueDate={new Date(item.dueDate)}*/}
								{/*	/>*/}
								{/*)}*/}
							</CardToolbar>
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
													value: invoice.invoiceSupplierBillingInfo.name ?? "-",
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
													value:
														invoice.invoiceSupplierBillingInfo.email ?? "-",
												},
												{
													key: "Street",
													value:
														invoice.invoiceSupplierBillingInfoAddress.street ??
														"-",
												},
												{
													key: "City",
													value:
														invoice.invoiceSupplierBillingInfoAddress.city ??
														"-",
												},
												{
													key: "Postal Code",
													value:
														invoice.invoiceSupplierBillingInfoAddress
															.postalCode ?? "-",
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
													value: invoice.invoiceCustomerBillingInfo.name ?? "-",
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
													value:
														invoice.invoiceCustomerBillingInfo.email ?? "-",
												},
												{
													key: "Street",
													value:
														invoice.invoiceCustomerBillingInfoAddress.street ??
														"-",
												},
												{
													key: "City",
													value:
														invoice.invoiceCustomerBillingInfoAddress.city ??
														"-",
												},
												{
													key: "Postal Code",
													value:
														invoice.invoiceCustomerBillingInfoAddress
															.postalCode ?? "-",
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
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link
									href={`/admin/invoices/edit?id=${encodeURIComponent(id)}`}
								>
									<EditIcon />
									Edit
								</Link>
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
