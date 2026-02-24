"use client";


import { useTranslation } from "react-i18next";
import { createIdFromString, type Id, sqliteTrue } from "@evolu/common";
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
import { InvoiceStatusBadge } from "@/app/admin/(private)/invoices/invoice-status-badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { generateCzechBankQrCode } from "@/lib/payment/czech-bank-qr-generator";
import { downloadFile } from "@/lib/shared/files/file-utils";
import { formatAmount, formatIban } from "@/lib/shared/utils/format";
import { createIsdocXml } from "@/lib/invoice/isdoc";
import { nestObjectSkipNullBranches } from "@/lib/shared/utils/object";
import { InvoiceStatus } from "@/lib/evolu/model/invoice-status";
import { type Invoice, InvoicePaymentMethod } from "@/lib/evolu/model/invoice";

const StatusButton: FC<{
	invoiceId: Id;
}> = (props) => {
	const evolu = useEvolu();
	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("invoiceStatus")
				.select("status")
				.where("id", "=", props.invoiceId)
				.where("isDeleted", "is not", sqliteTrue)
				.limit(1),
		[props.invoiceId],
	);
	const { data: invoiceStates } = useEvoluQuery(query);

	const invoiceStatus = invoiceStates ? invoiceStates[0] : undefined;
	const value = invoiceStatus ? invoiceStatus.status : null;

	const markAsPaid = async () => {
		evolu.upsert("invoiceStatus", {
			id: props.invoiceId,
			status: value === "unpaid" ? InvoiceStatus.Paid : InvoiceStatus.Unpaid,
		});
	};

	return (
		<Button variant={"outline"} className={"w-full"} onClick={markAsPaid}>
			<CoinsIcon />
			{value === null || value === "unpaid" ? "Mark as paid" : "Remove payment"}
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
						const customerEmail = props.invoice.customer.billingInfo.email;
						if (customerEmail === undefined) {
							return;
						}

						const [billingSettingsRows, smtpRows] = await Promise.all([
							(async () => {
								const query = evolu.createQuery((db) =>
									db
										.selectFrom("billingSettings")
										.selectAll()
										.where("isDeleted", "is not", sqliteTrue)
										.where("id", "=", createIdFromString("")),
								);
								return await evolu.loadQuery(query);
							})(),
							(async () => {
								const query = evolu.createQuery((db) =>
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
								to: `${props.invoice.customer.billingInfo.name} <${customerEmail}>`,
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

	const invoiceQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("invoice")
				.leftJoin(
					"invoiceCustomerBillingInfo",
					"invoiceCustomerBillingInfo.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceCustomerBillingInfoAddress",
					"invoiceCustomerBillingInfoAddress.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceCustomerBillingInfoCz",
					"invoiceCustomerBillingInfoCz.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceSupplierBillingInfo",
					"invoiceSupplierBillingInfo.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceSupplierBillingInfoAddress",
					"invoiceSupplierBillingInfoAddress.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceSupplierBillingInfoCz",
					"invoiceSupplierBillingInfoCz.id",
					"invoice.id",
				)
				.select([
					"invoice.id as id",
					"invoice.invoiceId as invoiceId",
					"invoice.invoiceNumber as invoiceNumber",
					"invoice.issueDate as issueDate",
					"invoice.dueDate as dueDate",
					"invoice.currency as currency",
					"invoice.paymentMethod as payment.method",
					"invoice.paymentIban as payment.iban",
					"invoice.createdAt as createdAt",

					"invoiceCustomerBillingInfo.name as customer.billingInfo.name",
					"invoiceCustomerBillingInfo.label as customer.billingInfo.label",
					"invoiceCustomerBillingInfo.email as customer.billingInfo.email",
					"invoiceCustomerBillingInfo.countryCode as customer.billingInfo.countryCode",
					"invoiceCustomerBillingInfoAddress.street as customer.billingInfo.address.street",
					"invoiceCustomerBillingInfoAddress.descriptiveNumber as customer.billingInfo.address.descriptiveNumber",
					"invoiceCustomerBillingInfoAddress.city as customer.billingInfo.address.city",
					"invoiceCustomerBillingInfoAddress.postalCode as customer.billingInfo.address.postalCode",
					"invoiceCustomerBillingInfoCz.identificationNumber as customer.billingInfo.countrySpecific.identificationNumber",
					"invoiceCustomerBillingInfoCz.vatNumber as customer.billingInfo.countrySpecific.vatNumber",
					"invoiceCustomerBillingInfoCz.caseNumber as customer.billingInfo.countrySpecific.caseNumber",

					"invoiceSupplierBillingInfo.name as supplier.billingInfo.name",
					"invoiceSupplierBillingInfo.label as supplier.billingInfo.label",
					"invoiceSupplierBillingInfo.email as supplier.billingInfo.email",
					"invoiceSupplierBillingInfo.countryCode as supplier.billingInfo.countryCode",
					"invoiceSupplierBillingInfoAddress.street as supplier.billingInfo.address.street",
					"invoiceSupplierBillingInfoAddress.descriptiveNumber as supplier.billingInfo.address.descriptiveNumber",
					"invoiceSupplierBillingInfoAddress.city as supplier.billingInfo.address.city",
					"invoiceSupplierBillingInfoAddress.postalCode as supplier.billingInfo.address.postalCode",
					"invoiceSupplierBillingInfoCz.vatPayer as supplier.billingInfo.countrySpecific.vatPayer",
					"invoiceSupplierBillingInfoCz.identificationNumber as supplier.billingInfo.countrySpecific.identificationNumber",
					"invoiceSupplierBillingInfoCz.vatNumber as supplier.billingInfo.countrySpecific.vatNumber",
					"invoiceSupplierBillingInfoCz.caseNumber as supplier.billingInfo.countrySpecific.caseNumber",
				])
				.where("invoice.id", "=", id as Id)
				.where("invoice.isDeleted", "is not", sqliteTrue),
		[id],
	);

	const itemsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("invoiceItem")
				.selectAll()
				.where("invoiceId", "=", id as Id)
				.where("isDeleted", "is not", sqliteTrue),
		[id],
	);

	const { data: invoiceRows } = useEvoluQuery(invoiceQuery);
	const { data: invoiceItemRows } = useEvoluQuery(itemsQuery);

	const item = useMemo(() => {
		const row = invoiceRows && invoiceRows[0];
		if (!row) return undefined;

		const nested = nestObjectSkipNullBranches(row);
		return {
			...nested,
			items: (invoiceItemRows ?? []).map((it) => ({
				label: it.label,
				price: it.price,
				quantity: it.quantity,
				unitOfMeasure: it.unitOfMeasure,
			})),
		} as unknown as { value: Invoice };
	}, [invoiceRows, invoiceItemRows]);

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("invoice", {
				id: item.id as Id,
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

	const totalAmount =
		item?.items.reduce((acc, value) => acc + value.price * value.quantity, 0) ??
		0;

	const paymentQrCode =
		item?.paymentMethod === InvoicePaymentMethod.BankTransfer &&
		totalAmount > 0 &&
		item.paymentIban.startsWith("CZ")
			? generateCzechBankQrCode({
					amount: totalAmount,
					currency: item.currency,
					iban: item.paymentIban,
					variableSymbol: item.invoiceNumber,
				})
			: null;

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<div className={"flex flex-2 gap-4 flex-col"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>
								{!item && <Skeleton />}
								{item?.invoiceNumber}
							</CardTitle>
							<CardToolbar>
								{item && (
									<InvoiceStatusBadge
										invoiceId={item.id}
										dueDate={new Date(item.dueDate)}
									/>
								)}
							</CardToolbar>
						</CardHeader>
						<CardContent>
							<div className={"flex flex-wrap flex-col gap-8"}>
								<div className={"flex gap-4"}>
									<StaticCard
										title={"Price"}
										content={
											<>
												{!item && <Skeleton />}
												{item &&
													`${formatAmount(
														item.items.reduce(
															(acc, value) =>
																acc + value.price * value.quantity,
															0,
														),
														item.currency,
													)}`}
											</>
										}
										className={"flex-1"}
									/>

									<StaticCard
										title={"Modified at"}
										content={
											<>
												{!item && <Skeleton />}
												{item && new Date(item.createdAt).toLocaleDateString()}
											</>
										}
										footer={
											item && new Date(item.createdAt).toLocaleTimeString()
										}
										className={"flex-1"}
									/>
								</div>
								<div className={"flex gap-4"}>
									<StaticCard
										title={"Issue date"}
										content={
											<>
												{!item && <Skeleton />}
												{item && new Date(item.issueDate).toLocaleDateString()}
											</>
										}
										className={"flex-1"}
									/>

									<StaticCard
										title={"Due date"}
										content={
											<>
												{!item && <Skeleton />}
												{item && new Date(item.dueDate).toLocaleDateString()}
											</>
										}
										className={"flex-1"}
									/>
								</div>

								<div className={"flex flex-wrap gap-8"}>
									<div className={"flex-1"}>
										<KeyValueList
											items={[
												{
													key: "Invoice number",
													value: item?.invoiceNumber ?? "-",
												},
												{
													key: "Price",
													value: item
														? formatAmount(
																item.items.reduce(
																	(acc, value) =>
																		acc + value.price * value.quantity,
																	0,
																),
																item.currency,
															)
														: "-",
												},
												{
													key: "Name",
													value: item?.supplier.billingInfo.name ?? "-",
												},
												{
													key: "VAT Number",
													value:
														item?.supplier.billingInfo.countrySpecific
															.vatNumber ?? "-",
												},
												{
													key: "Payment Method",
													value: item?.paymentMethod,
												},
												...(item?.paymentMethod ===
												InvoicePaymentMethod.BankTransfer
													? [
															{
																key: "IBAN",
																value: item?.paymentIban
																	? formatIban(item.paymentIban)
																	: "-",
															},
														]
													: []),
												{
													key: "E-mail",
													value: item?.supplier.billingInfo.email ?? "-",
												},
												{
													key: "Street",
													value:
														item?.supplier.billingInfo.address?.street ?? "-",
												},
												{
													key: "City",
													value:
														item?.supplier.billingInfo.address?.city ?? "-",
												},
												{
													key: "Postal Code",
													value:
														item?.supplier.billingInfo.address?.postalCode ??
														"-",
												},
												{
													key: "Country",
													value:
														item?.supplier.billingInfo.countrySpecific
															.countryCode ?? "-",
												},
											]}
										/>
									</div>
									<div className={"flex-1"}>
										<KeyValueList
											items={[
												{
													key: "Customer",
													value: item?.customer.billingInfo.name ?? "-",
												},
												{
													key: "VAT Number",
													value:
														item?.customer.billingInfo.countrySpecific
															.vatNumber ?? "-",
												},
												{
													key: "Identification Number",
													value:
														item?.customer.billingInfo.countrySpecific
															.identificationNumber ?? "-",
												},
												{
													key: "E-mail",
													value: item?.customer.billingInfo.email ?? "-",
												},
												{
													key: "Street",
													value:
														item?.customer.billingInfo.address?.street ?? "-",
												},
												{
													key: "City",
													value:
														item?.customer.billingInfo.address?.city ?? "-",
												},
												{
													key: "Postal Code",
													value:
														item?.customer.billingInfo.address?.postalCode ??
														"-",
												},
												{
													key: "Country",
													value:
														item?.customer.billingInfo.countrySpecific
															.countryCode ?? "-",
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
							{item && (
								<DownloadPdf invoice={item} paymentQrCode={paymentQrCode} />
							)}
							{item && <SendPdf invoice={item} paymentQrCode={paymentQrCode} />}
							{item && <ISDOCGenerator invoice={item} />}
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link
									href={`/admin/invoices/edit?id=${encodeURIComponent(id)}`}
								>
									<EditIcon />
									Edit
								</Link>
							</Button>
							{item && <StatusButton invoiceId={item.id} />}
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
							{item &&
								(paymentQrCode ? (
									<QrCodeImageBuilder qrCode={paymentQrCode}>
										{(qrUri) => (
											<PDFViewer
												width={"100%"}
												height={600}
												showToolbar={false}
											>
												<InvoiceTemplate qrCodeSrc={qrUri} invoice={item} />
											</PDFViewer>
										)}
									</QrCodeImageBuilder>
								) : (
									<PDFViewer width={"100%"} height={600} showToolbar={false}>
										<InvoiceTemplate invoice={item} qrCodeSrc={null} />
									</PDFViewer>
								))}
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}
