import { z } from "zod";
import { fetchApi } from "@/lib/http/api-client";
import {
	type IdentificationNumberCz,
	IdentificationNumberCzSchema,
	type NonEmptyString,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
} from "@/lib/shared/types";
import { jsonCodec } from "@/lib/shared/zod/json-codec";

const SubjectSchema = z.object({
	ico: IdentificationNumberCzSchema,
	dic: NonEmptyStringSchema.optional(),
	obchodniJmeno: NonEmptyStringSchema,
	sidlo: z.object({
		nazevStatu: NonEmptyStringSchema,
		nazevKraje: NonEmptyStringSchema.optional(),
		nazevObce: NonEmptyStringSchema,
		nazevUlice: NonEmptyStringSchema.optional(),
		nazevCastiObce: NonEmptyStringSchema,
		textovaAdresa: NonEmptyStringSchema,
		psc: NonNegativeIntegerSchema,
		cisloDomovni: NonNegativeIntegerSchema,
	}),
});

export class AresApiClient {
	public constructor(
		private readonly aresUrl = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest",
	) {}

	public async getSubject(params: { identificationNumber: NonEmptyString }) {
		return await fetchApi(
			`${this.aresUrl}/ekonomicke-subjekty/${encodeURIComponent(params.identificationNumber)}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				schema: jsonCodec(SubjectSchema),
			},
		);
	}

	public async searchSubject(params: {
		obchodniJmeno?: NonEmptyString;
		ico?: IdentificationNumberCz;
	}) {
		return await fetchApi(`${this.aresUrl}/ekonomicke-subjekty/vyhledat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				...(params.ico
					? {
							ico: [params.ico],
						}
					: {}),
				...(params.obchodniJmeno
					? {
							obchodniJmeno: params.obchodniJmeno,
						}
					: {}),
			}),
			schema: jsonCodec(
				z.object({
					ekonomickeSubjekty: SubjectSchema.array(),
				}),
			),
		});
	}
}
