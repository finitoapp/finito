const toCsvCell = (value: unknown): string => {
	return JSON.stringify(value ?? null);
};

const escapeCsvCell = (value: string): string => {
	if (
		value.includes(",") ||
		value.includes('"') ||
		value.includes("\n") ||
		value.includes("\r")
	) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
};

export const encodeCsv = (rows: Array<Record<string, unknown>>): Uint8Array => {
	const headers = Array.from(
		rows.reduce((set, row) => {
			for (const key of Object.keys(row)) set.add(key);
			return set;
		}, new Set<string>()),
	);

	const lines = [
		headers.join(","),
		...rows.map((row) =>
			headers.map((header) => escapeCsvCell(toCsvCell(row[header]))).join(","),
		),
	];

	return new TextEncoder().encode(lines.join("\n"));
};

const parseCsvText = (input: string): string[][] => {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		const next = input[i + 1];

		if (inQuotes) {
			if (char === '"' && next === '"') {
				field += '"';
				i++;
				continue;
			}
			if (char === '"') {
				inQuotes = false;
				continue;
			}
			field += char;
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}
		if (char === ",") {
			row.push(field);
			field = "";
			continue;
		}
		if (char === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			continue;
		}
		if (char === "\r" && next === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			i++;
			continue;
		}
		field += char;
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
};

const parseCsvCell = (value: string): unknown => {
	if (value === "") return null;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

export const decodeCsv = (
	bytes: Uint8Array,
): Array<Record<string, unknown>> => {
	const text = new TextDecoder().decode(bytes);
	const rows = parseCsvText(text);
	if (rows.length === 0) return [];

	const [headersRow, ...bodyRows] = rows;
	const headers = headersRow.filter((header) => header.length > 0);

	return bodyRows
		.filter((fields) => fields.some((field) => field.length > 0))
		.map((fields) => {
			const row: Record<string, unknown> = {};
			for (let i = 0; i < headers.length; i++) {
				row[headers[i]] = parseCsvCell(fields[i] ?? "");
			}
			return row;
		});
};
