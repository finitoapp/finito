"use client";

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
import { type FC, useEffect, useEffectEvent, useRef, useState } from "react";
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
import { useNostr } from "@/hooks/use-nostr";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { generateCzechBankQrCode } from "@/lib/czech-bank-qr-generator";
import { downloadFile } from "@/lib/file-utils";
import { formatAmount, formatIban } from "@/lib/format-utils";
import { createIsdocXml } from "@/lib/isdoc-utils";
import type { Uuid7 } from "@/lib/types";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";
import {
	InvoiceStatus,
	invoiceStatusStorage,
} from "@/storages/invoice-status-storage";
import {
	type Invoice,
	InvoicePaymentMethod,
	invoiceStorage,
} from "@/storages/invoice-storage";
import { smtpStorage } from "@/storages/smtp-storage";

const StatusButton: FC<{
	invoiceId: Uuid7;
}> = (props) => {
	const { ndk } = useNostr();
	const { data: invoiceStates } = useStorageSubscription(invoiceStatusStorage, {
		limit: 1,
		key: props.invoiceId,
	});

	const invoiceStatus = invoiceStates ? invoiceStates[0] : undefined;
	const value = invoiceStatus ? invoiceStatus.value.status : null;

	const markAsPaid = async () => {
		await invoiceStatusStorage.insertOrUpdate({ ndk }, props.invoiceId, {
			invoiceId: props.invoiceId,
			status:
				value === null || value === "unpaid"
					? InvoiceStatus.Paid
					: InvoiceStatus.Unpaid,
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
	const { ndk } = useNostr();

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

						const [{ data: billingSettingsRows }, { data: smtpRows }] =
							await Promise.all([
								billingSettingsStorage.select(
									{ ndk },
									{
										key: null,
										limit: 1,
									},
								),
								smtpStorage.select(
									{ ndk },
									{
										key: null,
										limit: 1,
									},
								),
							]);

						const smtp = smtpRows[0];
						if (smtp === undefined) {
							return;
						}

						const billingSettings = billingSettingsRows[0];
						if (
							billingSettings === undefined ||
							billingSettings.value.invoiceEmailSettings === undefined
						) {
							return;
						}

						const invoiceEmailSettings =
							billingSettings.value.invoiceEmailSettings;

						const reader = new FileReader();
						reader.onloadend = async () => {
							if (typeof reader.result !== "string") {
								return;
							}

							const base64data = reader.result.split(",")[1];

							await invoke("send_invoice", {
								server: smtp.value.server,
								port: smtp.value.port,
								username: smtp.value.credentials.username,
								password: smtp.value.credentials.password,
								from: smtp.value.name
									? `${smtp.value.name} <${smtp.value.email}>`
									: smtp.value.email,
								to: `${props.invoice.customer.billingInfo.name} <${customerEmail}>`,
								subject: invoiceEmailSettings.subject,
								body: invoiceEmailSettings.body,
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
	const searchParams = useSearchParams();
	const { ndk } = useNostr();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const { data: items } = useStorageSubscription(invoiceStorage, {
		key: id,
	});

	const item = items && items[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			await invoiceStorage.delete({ ndk }, item.eventId);
			router.push("/admin/invoices");
		},
	});

	const totalAmount =
		item?.value.items.reduce(
			(acc, value) => acc + value.price * value.quantity,
			0,
		) ?? 0;

	const paymentQrCode =
		item?.value.payment.method === InvoicePaymentMethod.BankTransfer &&
		totalAmount > 0 &&
		item.value.payment.iban.startsWith("CZ")
			? generateCzechBankQrCode({
					amount: totalAmount,
					currency: item.value.currency,
					iban: item.value.payment.iban,
					variableSymbol: item.value.invoiceNumber,
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
								{item?.value.invoiceNumber}
							</CardTitle>
							<CardToolbar>
								{item && (
									<InvoiceStatusBadge
										invoiceId={item.value.id}
										dueDate={new Date(item.value.dueDate)}
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
														item.value.items.reduce(
															(acc, value) =>
																acc + value.price * value.quantity,
															0,
														),
														item.value.currency,
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
												{item &&
													new Date(item.createdAt * 1000).toLocaleDateString()}
											</>
										}
										footer={
											item &&
											new Date(item.createdAt * 1000).toLocaleTimeString()
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
												{item &&
													new Date(item.value.issueDate).toLocaleDateString()}
											</>
										}
										className={"flex-1"}
									/>

									<StaticCard
										title={"Due date"}
										content={
											<>
												{!item && <Skeleton />}
												{item &&
													new Date(item.value.dueDate).toLocaleDateString()}
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
													value: item?.value.invoiceNumber ?? "-",
												},
												{
													key: "Price",
													value: item
														? formatAmount(
																item.value.items.reduce(
																	(acc, value) =>
																		acc + value.price * value.quantity,
																	0,
																),
																item.value.currency,
															)
														: "-",
												},
												{
													key: "Name",
													value: item?.value.supplier.billingInfo.name ?? "-",
												},
												{
													key: "VAT Number",
													value:
														item?.value.supplier.billingInfo.countrySpecific
															.vatNumber ?? "-",
												},
												{
													key: "Payment Method",
													value: item?.value.payment.method,
												},
												...(item?.value.payment.method ===
												InvoicePaymentMethod.BankTransfer
													? [
															{
																key: "IBAN",
																value: item?.value.payment.iban
																	? formatIban(item.value.payment.iban)
																	: "-",
															},
														]
													: []),
												{
													key: "E-mail",
													value: item?.value.supplier.billingInfo.email ?? "-",
												},
												{
													key: "Street",
													value:
														item?.value.supplier.billingInfo.address?.street ??
														"-",
												},
												{
													key: "City",
													value:
														item?.value.supplier.billingInfo.address?.city ??
														"-",
												},
												{
													key: "Postal Code",
													value:
														item?.value.supplier.billingInfo.address
															?.postalCode ?? "-",
												},
												{
													key: "Country",
													value:
														item?.value.supplier.billingInfo.countrySpecific
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
													value: item?.value.customer.billingInfo.name ?? "-",
												},
												{
													key: "VAT Number",
													value:
														item?.value.customer.billingInfo.countrySpecific
															.vatNumber ?? "-",
												},
												{
													key: "Identification Number",
													value:
														item?.value.customer.billingInfo.countrySpecific
															.identificationNumber ?? "-",
												},
												{
													key: "E-mail",
													value: item?.value.customer.billingInfo.email ?? "-",
												},
												{
													key: "Street",
													value:
														item?.value.customer.billingInfo.address?.street ??
														"-",
												},
												{
													key: "City",
													value:
														item?.value.customer.billingInfo.address?.city ??
														"-",
												},
												{
													key: "Postal Code",
													value:
														item?.value.customer.billingInfo.address
															?.postalCode ?? "-",
												},
												{
													key: "Country",
													value:
														item?.value.customer.billingInfo.countrySpecific
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
							<CardTitle>Actions</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							{item && (
								<DownloadPdf
									invoice={item.value}
									paymentQrCode={paymentQrCode}
								/>
							)}
							{item && (
								<SendPdf invoice={item.value} paymentQrCode={paymentQrCode} />
							)}
							{item && <ISDOCGenerator invoice={item.value} />}
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link
									href={`/admin/invoices/edit?id=${encodeURIComponent(id)}`}
								>
									<EditIcon />
									Edit
								</Link>
							</Button>
							{item && <StatusButton invoiceId={item.value.id} />}
							<Button className={"w-full"} onClick={() => deleteItem()}>
								<Trash2Icon />
								Delete
							</Button>
						</CardContent>
					</ResponsiveCard>

					<ResponsiveCard>
						<CardHeader>
							<CardTitle>PDF invoice preview</CardTitle>
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
												<InvoiceTemplate
													qrCodeSrc={qrUri}
													invoice={item.value}
												/>
											</PDFViewer>
										)}
									</QrCodeImageBuilder>
								) : (
									<PDFViewer width={"100%"} height={600} showToolbar={false}>
										<InvoiceTemplate invoice={item.value} qrCodeSrc={null} />
									</PDFViewer>
								))}
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}
