import { sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
import { useMemo } from "react";
import type { AutoFormComponent } from "@/components/auto-form";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";
import { IbanSchema } from "@/lib/shared/types";
import { formatIban } from "@/lib/shared/utils/format";

export const AutoformIbanInput: AutoFormComponent<string> = (props) => {
	const evolu = useEvolu();
	const ComboboxInput = useMemo(
		() =>
			createComboboxOrTextInput<string>({
				label: "IBAN",
				formatCustomValue: (value) => {
					const result = IbanSchema.safeParse(value);
					return result.success ? formatIban(result.data) : value;
				},
				fetchItems: async () => {
					const query = createQuery((db) =>
						db
							.selectFrom("account")
							.innerJoin("accountIban", "accountIban.id", "account.id")
							.select(["account.id", "account.name", "accountIban.iban"])
							.where("_tag", "=", "accountIban")
							.where("account.isDeleted", "is not", sqliteTrue)
							.where("account.name", "is not", null)
							.where("accountIban.iban", "is not", null)
							.$narrowType<{
								name: NotNull;
								iban: NotNull;
							}>(),
					);
					const items = await evolu.loadQuery(query);

					return items.map((item) => {
						return {
							label: `${formatIban(item.iban)} (${item.name})`,
							value: item.iban,
						};
					});
				},
			}),
		[evolu],
	);

	return <ComboboxInput {...props} />;
};
