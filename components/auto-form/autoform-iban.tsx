import { useMemo } from "react";
import type { AutoFormComponent } from "@/components/auto-form";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import { formatIban } from "@/lib/format-utils";
import { IbanSchema } from "@/lib/types";
import { accountStorage } from "@/storages/account-storage";

export const AutoformIbanInput: AutoFormComponent<string> = (props) => {
	const storageDeps = useStorageDeps();
	const ComboboxInput = useMemo(
		() =>
			createComboboxOrTextInput<string>({
				label: "IBAN",
				formatCustomValue: (value) => {
					const result = IbanSchema.safeParse(value);
					return result.success ? formatIban(result.data) : value;
				},
				fetchItems: async () => {
					const items = await accountStorage.select(storageDeps);

					return items.data
						.filter((item) => item.value._tag === "iban")
						.map((item) => ({
							label:
								item.value._tag === "iban"
									? `${formatIban(item.value.iban)} (${item.value.name})`
									: "-",
							value: item.value._tag === "iban" ? item.value.iban : "-",
						}));
				},
			}),
		[storageDeps],
	);

	return <ComboboxInput {...props} />;
};
