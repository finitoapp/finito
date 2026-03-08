export function lazy<T>(factory: () => T): () => T {
	let initialized = false;
	let value: T;

	return () => {
		if (!initialized) {
			value = factory();
			initialized = true;
		}
		return value;
	};
}
