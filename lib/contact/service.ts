import type { EvoluSchemaType } from "@/lib/evolu";
import type { EvoluDep } from "@/lib/shared/dependencies";

export const createContact =
	(deps: EvoluDep) =>
	({
		contact: { account, nostr, ...contact },
	}: {
		contact: EvoluSchemaType["contact"] & {
			account?: Omit<
				EvoluSchemaType["contactAccount"],
				"contactId" | "deviceId" | "_tag"
			> & {
				lud16: Omit<EvoluSchemaType["contactAccountLud16"], "id">;
			};
			nostr?: Omit<EvoluSchemaType["contactNostr"], "contactId">;
		};
	}) => {
		deps.evolu.upsert("contact", contact);

		if (account) {
			const { lud16, ...contactAccount } = account;

			deps.evolu.upsert("contactAccount", {
				...contactAccount,
				deviceId: contact.deviceId,
				contactId: contact.id,
				_tag: "accountLud16",
			});

			deps.evolu.upsert("contactAccountLud16", {
				...lud16,
				id: contactAccount.id,
			});
		}

		if (nostr) {
			deps.evolu.upsert("contactNostr", {
				...nostr,
				contactId: contact.id,
			});
		}
	};
