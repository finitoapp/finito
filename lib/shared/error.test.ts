import { describe, expect, it } from "bun:test";
import { defineError } from "@/lib/shared/error";

describe("defineError", () => {
	it("creates an error object without payload", () => {
		const createUnauthorizedError = defineError("UnauthorizedError")();

		const error = createUnauthorizedError();

		expect(error).toEqual({
			type: "UnauthorizedError",
		});
	});

	it("creates an error object with payload fields", () => {
		const createValidationError = defineError("ValidationError")<{
			field: string;
			reason: string;
		}>();

		const error = createValidationError({
			field: "email",
			reason: "missing",
		});

		expect(error).toEqual({
			type: "ValidationError",
			field: "email",
			reason: "missing",
		});
	});

	it.skip("Typer error", () => {
		const createValidationError = defineError("ValidationError")<{
			field: string;
			reason: string;
		}>();

		// @ts-expect-error
		createValidationError();

		const createUnauthorizedError = defineError("UnauthorizedError")();

		// @ts-expect-error
		createUnauthorizedError({});
	});
});
