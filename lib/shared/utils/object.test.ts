import { describe, expect, it } from "bun:test";
import { nestObjectSkipNullBranches } from "@/lib/shared/utils/object";

describe("nestObjectSkipNullBranches", () => {
	it("should nest flat object with dots", () => {
		const flat = {
			foo: "abc",
			"a.b": 123,
			"x.y.z": "nested",
		};
		const expected = {
			foo: "abc",
			a: { b: 123 },
			x: { y: { z: "nested" } },
		};
		expect(nestObjectSkipNullBranches(flat)).toEqual(expected as any);
	});

	it("should skip branches that are null", () => {
		const flat = {
			"a.b": 1,
			c: null,
			"c.d": 2,
			"e.f": null,
			"e.f.g": 3,
		};
		// c is null and has descendants (c.d), so the whole c branch should be skipped
		// e.f is null and has descendants (e.f.g), so the e.f branch should be skipped
		const expected = {
			a: { b: 1 },
		};
		expect(nestObjectSkipNullBranches(flat)).toEqual(expected as any);
	});

	it("should keep null values if they have no descendants", () => {
		const flat = {
			a: 1,
			b: null,
		};
		const expected = {
			a: 1,
			b: null,
		};
		expect(nestObjectSkipNullBranches(flat)).toEqual(expected as any);
	});

	it("should skip undefined values", () => {
		const flat = {
			a: 1,
			b: undefined,
		};
		const expected = {
			a: 1,
		};
		expect(nestObjectSkipNullBranches(flat)).toEqual(expected as any);
	});

	it("should handle overlapping paths", () => {
		const flat = {
			a: { x: 10 }, // This is already an object in the input
			"a.b": 1,
		};
		// Note: the input type T extends Record<string, any>, so values can be objects.
		// But usually it's used with flat objects from forms.
		const expected = {
			a: {
				x: 10,
				b: 1,
			},
		};
		expect(nestObjectSkipNullBranches(flat)).toEqual(expected as any);
	});

	it("should remove empty objects after cleaning nulls", () => {
		const flat = {
			"a.b": null,
			"a.c": null,
		};
		// a.b and a.c are deleted, then a becomes empty and is also deleted.
		const expected = {
			a: {
				b: null,
				c: null,
			},
		};
		expect(nestObjectSkipNullBranches(flat)).toEqual(expected as any);
	});
});
