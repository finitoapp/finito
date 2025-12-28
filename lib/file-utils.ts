import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export const downloadFile = async (params: {
	bytes: ConstructorParameters<typeof Blob>[0];
	mimetype: string;
	fileName: string;
}) => {
	const blob = new Blob(params.bytes, {
		type: params.mimetype,
	});

	if (isTauri() && save !== undefined && writeFile !== undefined) {
		const filePath = await save({
			defaultPath: params.fileName,
		});
		if (filePath === null) {
			return;
		}

		await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));

		return;
	}

	const url = URL.createObjectURL(blob);

	downloadStringAsFile({
		data: url,
		fileName: params.fileName,
	});

	URL.revokeObjectURL(url);
};

const downloadStringAsFile = (params: { data: string; fileName: string }) => {
	const a = document.createElement("a");
	a.style.display = "none";
	a.href = params.data;
	a.download = params.fileName;

	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
};

export const shareImageOrDownload = async (params: {
	blob: Blob;
	mimetype: "image/jpeg" | "image/png";
	fileName: string;
	title?: string;
	text?: string;
}) => {
	const file = new File([params.blob], params.fileName, {
		type: params.mimetype,
	});

	// Check if shareable (optional but good practice)
	if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
		const url = URL.createObjectURL(params.blob);
		return downloadStringAsFile({
			data: url,
			fileName: params.fileName,
		});
	}

	// Trigger the share dialog (system chooser)
	await navigator.share({
		files: [file],
		title: params.title,
		text: params.text,
	});
};
