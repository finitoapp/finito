import { sqliteTrue } from "@evolu/common";
import type { EvoluSchemaType } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";
import { createItem } from "@/lib/item/service";
import type { EvoluDep } from "@/lib/shared/dependencies";
import { Integer } from "@/lib/shared/types";

export const createInvoice =
	(deps: EvoluDep) =>
	async (params: {
		originalItemLineIds: Id[];
		invoice: EvoluSchemaType["invoice"] & {
			items: ReadonlyArray<
				Omit<
					EvoluSchemaType["invoiceItemLine"],
					"invoiceId" | "catalogItemId" | "itemId" | "totalAmount"
				> & {
					item: Omit<EvoluSchemaType["item"], "id" | "deviceId">;
				}
			>;
			customer: Omit<EvoluSchemaType["invoiceCustomer"], "id"> & {
				address: Omit<EvoluSchemaType["invoiceCustomerAddress"], "id">;
				billingInfo: Omit<
					EvoluSchemaType["invoiceCustomerBillingInfo"],
					"id"
				> & {
					cz: Omit<EvoluSchemaType["invoiceCustomerBillingInfoCz"], "id">;
				};
			};
			supplier: Omit<EvoluSchemaType["invoiceSupplier"], "id"> & {
				address: Omit<EvoluSchemaType["invoiceSupplierAddress"], "id">;
				billingInfo: Omit<
					EvoluSchemaType["invoiceSupplierBillingInfo"],
					"id"
				> & {
					cz: Omit<EvoluSchemaType["invoiceSupplierBillingInfoCz"], "id">;
				};
			};
		};
	}) => {
		const { items, customer, supplier, ...invoice } = params.invoice;

		deps.evolu.upsert("invoice", {
			id: invoice.id,
			invoiceId: invoice.invoiceId,
			invoiceNumber: invoice.invoiceNumber,
			issueDate: invoice.issueDate,
			dueDate: invoice.dueDate,
			currency: invoice.currency,
			paymentMethod: invoice.paymentMethod,
			paymentIban: invoice.paymentIban,
		});

		{
			const {
				address,
				billingInfo: { cz, ...billingInfo },
				...contact
			} = customer;
			deps.evolu.upsert("invoiceCustomer", {
				...contact,
				id: invoice.id,
			});
			deps.evolu.upsert("invoiceCustomerAddress", {
				...address,
				id: invoice.id,
			});
			deps.evolu.upsert("invoiceCustomerBillingInfo", {
				...billingInfo,
				id: invoice.id,
			});
			deps.evolu.upsert("invoiceCustomerBillingInfoCz", {
				...cz,
				id: invoice.id,
			});
		}

		{
			const {
				address,
				billingInfo: { cz, ...billingInfo },
				...contact
			} = supplier;
			deps.evolu.upsert("invoiceSupplier", {
				...contact,
				id: invoice.id,
			});
			deps.evolu.upsert("invoiceSupplierAddress", {
				...address,
				id: invoice.id,
			});
			deps.evolu.upsert("invoiceSupplierBillingInfo", {
				...billingInfo,
				id: invoice.id,
			});
			deps.evolu.upsert("invoiceSupplierBillingInfoCz", {
				...cz,
				id: invoice.id,
			});
		}

		const originalItemLineIds = new Set(params.originalItemLineIds);

		for (const lineItem of items) {
			originalItemLineIds.delete(lineItem.id);

			const item = await createItem(deps)({
				item: lineItem.item,
			});

			deps.evolu.upsert("invoiceItemLine", {
				id: lineItem.id,
				invoiceId: invoice.id,
				catalogItemId: item.catalogItemId,
				itemId: item.id,
				quantity: lineItem.quantity,
				totalAmount: Integer(
					Math.round(lineItem.item.price * lineItem.quantity),
				),
			});
		}

		for (const itemId of originalItemLineIds) {
			if (itemId) {
				deps.evolu.update("invoiceItemLine", {
					id: itemId,
					isDeleted: sqliteTrue,
				});
			}
		}
	};
