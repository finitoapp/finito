import { sqliteTrue } from "@evolu/common";
import { useMemo } from "react";
import type { AutoFormComponent } from "@/components/auto-form";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import { useEvolu } from "@/hooks/use-evolu";
import { formatIban } from "@/lib/shared/utils/format";
import { IbanSchema } from "@/lib/shared/types";

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
					const query = evolu.createQuery((db) =>
						db
							.selectFrom("account")
							.leftJoin("accountIban", "accountIban.id", "account.id")
							.select(["account.id", "account.name", "accountIban.iban"])
							.where("_tag", "=", "accountIban")
							.where("account.isDeleted", "is not", sqliteTrue),
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
