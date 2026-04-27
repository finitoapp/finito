"use client";

import { usePDF } from "@react-pdf/renderer";
import { useMutation } from "@tanstack/react-query";
import { DownloadIcon, FileTextIcon } from "lucide-react";
import type { FC } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import type { PaymentReceipt } from "@/lib/evolu/model/payment-receipt";
import { PaymentStatus } from "@/lib/evolu/model/payment-status";
import type { Id } from "@/lib/evolu/types";
import { createPaymentReceiptQuery } from "@/lib/payment-receipt/query";
import {
	type IssuePaymentReceiptError,
	issuePaymentReceipt,
} from "@/lib/payment-receipt/service";
import { downloadFile } from "@/lib/shared/files/file-utils";
import { PaymentReceiptTemplate } from "./payment-receipt-cz";

const getIssuePaymentReceiptErrorMessage = (
	t: ReturnType<typeof useTranslation>["t"],
	error: IssuePaymentReceiptError,
) => {
	switch (error.type) {
		case "IssuePaymentReceiptPaymentNotFoundError":
			return t("payments:detail.messages.receipt-errors.payment-not-found");
		case "IssuePaymentReceiptUnsupportedDirectionError":
			return t("payments:detail.messages.receipt-errors.unsupported-direction");
		case "IssuePaymentReceiptPaymentNotSettledError":
			return t("payments:detail.messages.receipt-errors.payment-not-settled");
		case "IssuePaymentReceiptSupplierNotConfiguredError":
			return t(
				"payments:detail.messages.receipt-errors.supplier-not-configured",
			);
		case "IssuePaymentReceiptSupplierBillingInfoMissingError":
			return t(
				"payments:detail.messages.receipt-errors.supplier-billing-info-missing",
			);
	}
};

const RawPaymentReceiptPdfGenerator = (props: {
	fileName: string;
	onGenerated: (params: {
		bytes: BlobPart[];
		mimetype: string;
		fileName: string;
	}) => void;
	receipt: PaymentReceipt;
}) => {
	const [instance] = usePDF({
		document: <PaymentReceiptTemplate receipt={props.receipt} />,
	});
	const hasGeneratedRef = useRef(false);

	useEffect(() => {
		if (instance.blob === null || hasGeneratedRef.current) {
			return;
		}

		hasGeneratedRef.current = true;
		props.onGenerated({
			bytes: [instance.blob],
			mimetype: "application/pdf",
			fileName: props.fileName,
		});
	}, [instance.blob, props]);

	return null;
};

export const DownloadPaymentReceiptButton: FC<{
	paymentId: Id;
	paymentStatus: PaymentStatus;
}> = ({ paymentId, paymentStatus }) => {
	const { i18n, t } = useTranslation();
	const evolu = useEvolu();
	const [shouldDownload, setShouldDownload] = useState(false);
	const [downloadKey, setDownloadKey] = useState(0);
	const receiptQuery = useMemo(
		() => createPaymentReceiptQuery(paymentId),
		[paymentId],
	);
	const { data: receiptRows } = useEvoluQuery(receiptQuery);
	const receipt = receiptRows[0];
	const isPreparingDownload = shouldDownload && receipt === undefined;

	const { mutateAsync: ensureReceipt, isPending } = useMutation({
		mutationFn: async () => {
			const result = await issuePaymentReceipt({ evolu })({
				paymentId,
			});
			if (!result.ok) {
				return result;
			}

			return result;
		},
	});

	const onClick = async () => {
		if (receipt !== undefined) {
			setDownloadKey((value) => value + 1);
			setShouldDownload(true);
			return;
		}

		const result = await ensureReceipt();
		if (!result.ok) {
			toast.error(getIssuePaymentReceiptErrorMessage(t, result.error));
			return;
		}

		setDownloadKey((value) => value + 1);
		setShouldDownload(true);
	};

	const helperText =
		receipt !== undefined
			? t("payments:detail.messages.receipt-issued", {
					receiptNumber: receipt.receiptNumber,
					issuedAt: new Date(receipt.issuedAt).toLocaleString(
						i18n.language.startsWith("cs") ? "cs-CZ" : "en-US",
					),
				})
			: paymentStatus === PaymentStatus.Unpaid
				? t("payments:detail.messages.receipt-can-be-issued-after-settlement")
				: null;

	return (
		<>
			<Button
				variant={"outline"}
				className={"w-full"}
				disabled={
					isPending ||
					shouldDownload ||
					isPreparingDownload ||
					(receipt === undefined && paymentStatus === PaymentStatus.Unpaid)
				}
				onClick={() => void onClick()}
			>
				{receipt !== undefined ? <DownloadIcon /> : <FileTextIcon />}
				{isPreparingDownload
					? t("payments:detail.actions.preparing-receipt")
					: receipt !== undefined
						? t("payments:detail.actions.download-receipt")
						: t("payments:detail.actions.issue-receipt")}
			</Button>

			{helperText && (
				<p className={"text-sm text-muted-foreground"}>{helperText}</p>
			)}

			{shouldDownload && receipt !== undefined && (
				<RawPaymentReceiptPdfGenerator
					key={downloadKey}
					fileName={`receipt-${receipt.receiptNumber}.pdf`}
					receipt={receipt}
					onGenerated={async (params) => {
						try {
							await downloadFile(params);
						} finally {
							setShouldDownload(false);
						}
					}}
				/>
			)}
		</>
	);
};
