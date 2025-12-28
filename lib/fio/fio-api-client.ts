import { z } from "zod";
import { fetchApi } from "@/lib/api-client";
import { type DateString, FiatCurrency, IbanSchema } from "@/lib/types";
import { jsonCodec } from "@/lib/zod/jsonCodec";

const SubjectSchema = z.object({
	accountStatement: z.object({
		info: z.object({
			iban: IbanSchema,
		}),
		transactionList: z.object({
			transaction: z
				.record(
					z.string(),
					z
						.object({
							value: z.union([z.string(), z.number()]),
							name: z.string(),
						})
						.nullable(),
				)
				.transform((values) =>
					Object.values(values).reduce(
						(acc, value) => {
							if (value === null) {
								return acc;
							}
							acc[value.name] = value.value;
							return acc;
						},
						{} as Record<string, string | number | unknown>,
					),
				)
				.pipe(
					z.union([
						z.looseObject({
							Typ: z.literal("Bezhotovostní příjem"),
							VS: z.string(),
							Měna: z.enum(FiatCurrency),
							Objem: z.number(),
						}),
						z.looseObject({
							Typ: z.literal("Příjem převodem uvnitř banky"),
							VS: z.string(),
							Měna: z.enum(FiatCurrency),
							Objem: z.number(),
						}),
						z.looseObject({
							Typ: z.string(),
						}),
					]),
				)
				.array(),
		}),
	}),
});

export class FioApiClient {
	private tokenIndex = 0;

	public constructor(
		// API can be called only once every 30s.
		// Therefore, the only workaround is to use multiple tokens and rotate them.
		private readonly tokens: string[],
		private readonly fioUrl = "https://fioapi.fio.cz",
	) {}

	private getToken() {
		const token = this.tokens[this.tokenIndex++];

		if (this.tokenIndex >= this.tokens.length) {
			this.tokenIndex = 0;
		}

		return token;
	}

	public async getTransactions() {
		return await fetchApi(
			`${this.fioUrl}/v1/rest/last/${this.getToken()}/transactions.json`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				schema: jsonCodec(SubjectSchema),
			},
		);
	}

	public async setLastId(params: { date: DateString }) {
		return await fetchApi(
			`${this.fioUrl}/v1/rest/set-last-date/${this.getToken()}/${params.date}/`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				schema: z.string(),
			},
		);
	}
}
