import { z } from "zod";
import { createAutocompleteSelectInput } from "@/components/autocomplete-select-input";
import type { AddressSchema } from "@/lib/evolu/model/payment";
import { AresApiClient } from "@/lib/integrations/ares/client";
import {
	IdentificationNumberCzSchema,
	NonEmptyString32,
	NonEmptyString255,
	NonEmptyStringSchema,
} from "@/lib/shared/types";

export type AutocompleteIdentificationNumberItem = {
	name: string;
	identificationNumber: string;
	vatNumber: string;
	address: z.input<typeof AddressSchema>;
	addressLine: string;
};

const aresApiClient = new AresApiClient();

export const AutocompleteIdentificationNumberInput =
	createAutocompleteSelectInput<AutocompleteIdentificationNumberItem>({
		placeholder: "e.g. Company Name or identification Number",
		itemToKeyValue: (item) => item.identificationNumber,
		itemToStringValue: (item) => item.name,
		fetchItems: async (searchValue) => {
			const identificationNumberCzResult = z
				.union([
					IdentificationNumberCzSchema.transform(
						(value) =>
							({
								type: "ico",
								value: value,
							}) as const,
					),
					NonEmptyStringSchema.transform(
						(value) =>
							({
								type: "name",
								value: value,
							}) as const,
					),
				])
				.safeParse(searchValue);
			if (!identificationNumberCzResult.success) {
				return [];
			}
			const searchSubjectResult = await aresApiClient.searchSubject({
				...(identificationNumberCzResult.data.type === "ico"
					? {
							ico: identificationNumberCzResult.data.value,
						}
					: {
							obchodniJmeno: identificationNumberCzResult.data.value,
						}),
			});

			return searchSubjectResult.ekonomickeSubjekty.map((row) => ({
				name: row.obchodniJmeno,
				identificationNumber: row.ico ?? "",
				vatNumber: row.dic ?? "",
				address: {
					street: NonEmptyString255(
						`${row.sidlo.nazevUlice ?? row.sidlo.nazevCastiObce}`,
					),
					descriptiveNumber: NonEmptyString32(`${row.sidlo.cisloDomovni}`),
					city: row.sidlo.nazevObce,
					postalCode: NonEmptyString32(`${row.sidlo.psc}`),
				},
				addressLine: row.sidlo.textovaAdresa,
			}));
		},
		ListItemComponent: ({ item }) => (
			<div className="flex items-center gap-2.5 truncate">
				<div className="flex-1 min-w-0">
					<div className="font-medium truncate">
						IČO: {item.identificationNumber} - {item.name}
					</div>
					<div className="text-sm text-muted-foreground truncate">
						{item.addressLine}
					</div>
				</div>
			</div>
		),
	});
