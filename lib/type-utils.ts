export function assertNotNull<T>(
	value: T,
): asserts value is T extends null ? never : T {
	if (value === null) {
		throw new TypeError("Value must not be null");
	}
}

export function assertNotUndefined<T>(
	value: T,
): asserts value is T extends undefined ? never : T {
	if (value === null) {
		throw new TypeError("Value must not be undefined");
	}
}

export function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
