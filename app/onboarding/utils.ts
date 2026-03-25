export const getSafeReturnTo = (value: string | null) => {
	if (value !== null && value.startsWith("/") && !value.startsWith("//")) {
		return value;
	}

	return "/";
};

export const withReturnTo = (path: string, returnTo: string) => {
	const params = new URLSearchParams();
	params.set("returnTo", returnTo);

	return `${path}?${params.toString()}`;
};
