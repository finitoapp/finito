import { describe, expect, it } from "bun:test";
import { stableStringify } from "@/lib/shared/utils/json";

describe("stableStringify", () => {
	it("sorts object keys recursively", () => {
		expect(
			stableStringify({
				b: 1,
				a: {
					d: 2,
					c: 3,
				},
			}),
		).toBe('{"a":{"c":3,"d":2},"b":1}');
	});

	it("preserves array order while sorting nested object keys", () => {
		expect(
			stableStringify([
				{
					b: 1,
					a: 2,
				},
				{
					d: 4,
					c: 3,
				},
			]),
		).toBe('[{"a":2,"b":1},{"c":3,"d":4}]');
	});

	it("returns the same string for the same object with different key order", () => {
		expect(
			stableStringify({
				b: 1,
				a: "x",
			}),
		).toBe(
			stableStringify({
				a: "x",
				b: 1,
			}),
		);
	});
});
