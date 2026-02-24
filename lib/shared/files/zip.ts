const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
	const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
};

const createCrc32 = () => {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) {
			c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[i] = c >>> 0;
	}
	return (input: Uint8Array): number => {
		let crc = 0xffffffff;
		for (const byte of input) {
			crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
		}
		return (crc ^ 0xffffffff) >>> 0;
	};
};

export type ZipFile = {
	name: string;
	data: Uint8Array;
};

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

export const createZip = (files: ZipFile[]): Uint8Array => {
	const crc32 = createCrc32();
	const localParts: Uint8Array[] = [];
	const centralParts: Uint8Array[] = [];
	let offset = 0;

	for (const file of files) {
		const nameBytes = new TextEncoder().encode(file.name);
		const data = file.data;
		const crc = crc32(data);

		const localHeader = new Uint8Array(30);
		const localView = new DataView(localHeader.buffer);
		localView.setUint32(0, 0x04034b50, true);
		localView.setUint16(4, 20, true);
		localView.setUint16(6, 0, true);
		localView.setUint16(8, 0, true);
		localView.setUint16(10, 0, true);
		localView.setUint16(12, 0, true);
		localView.setUint32(14, crc, true);
		localView.setUint32(18, data.length, true);
		localView.setUint32(22, data.length, true);
		localView.setUint16(26, nameBytes.length, true);
		localView.setUint16(28, 0, true);
		localParts.push(localHeader, nameBytes, data);

		const centralHeader = new Uint8Array(46);
		const centralView = new DataView(centralHeader.buffer);
		centralView.setUint32(0, 0x02014b50, true);
		centralView.setUint16(4, 20, true);
		centralView.setUint16(6, 20, true);
		centralView.setUint16(8, 0, true);
		centralView.setUint16(10, 0, true);
		centralView.setUint16(12, 0, true);
		centralView.setUint16(14, 0, true);
		centralView.setUint32(16, crc, true);
		centralView.setUint32(20, data.length, true);
		centralView.setUint32(24, data.length, true);
		centralView.setUint16(28, nameBytes.length, true);
		centralView.setUint16(30, 0, true);
		centralView.setUint16(32, 0, true);
		centralView.setUint16(34, 0, true);
		centralView.setUint16(36, 0, true);
		centralView.setUint32(38, 0, true);
		centralView.setUint32(42, offset, true);
		centralParts.push(centralHeader, nameBytes);

		offset += localHeader.length + nameBytes.length + data.length;
	}

	const centralData = concatBytes(centralParts);
	const end = new Uint8Array(22);
	const endView = new DataView(end.buffer);
	endView.setUint32(0, 0x06054b50, true);
	endView.setUint16(4, 0, true);
	endView.setUint16(6, 0, true);
	endView.setUint16(8, files.length, true);
	endView.setUint16(10, files.length, true);
	endView.setUint32(12, centralData.length, true);
	endView.setUint32(16, offset, true);
	endView.setUint16(20, 0, true);

	return concatBytes([...localParts, centralData, end]);
};

export const extractZip = (bytes: Uint8Array): ZipFile[] => {
	const files: ZipFile[] = [];
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 0;

	while (offset + 4 <= bytes.length) {
		const signature = view.getUint32(offset, true);
		if (signature === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
			break;
		}
		if (signature === CENTRAL_DIRECTORY_SIGNATURE) {
			break;
		}
		if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
			throw new Error("Unsupported ZIP format.");
		}

		const compressionMethod = view.getUint16(offset + 8, true);
		const compressedSize = view.getUint32(offset + 18, true);
		const fileNameLength = view.getUint16(offset + 26, true);
		const extraFieldLength = view.getUint16(offset + 28, true);

		if (compressionMethod !== 0) {
			throw new Error("Only uncompressed ZIP entries are supported.");
		}

		const nameStart = offset + 30;
		const nameEnd = nameStart + fileNameLength;
		const dataStart = nameEnd + extraFieldLength;
		const dataEnd = dataStart + compressedSize;

		if (dataEnd > bytes.length) {
			throw new Error("Corrupted ZIP archive.");
		}

		const name = new TextDecoder().decode(bytes.slice(nameStart, nameEnd));
		const data = bytes.slice(dataStart, dataEnd);
		files.push({ name, data });

		offset = dataEnd;
	}

	return files;
};
