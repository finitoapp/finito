import csAccounts from "@/locales/cs/accounts";
import csAdmin from "@/locales/cs/admin";
import csApp from "@/locales/cs/app";
import csAuth from "@/locales/cs/auth";
import csBills from "@/locales/cs/bills";
import csCategories from "@/locales/cs/categories";
import csClient from "@/locales/cs/client";
import csCommon from "@/locales/cs/common";
import csComponents from "@/locales/cs/components";
import csContacts from "@/locales/cs/contacts";
import csDevices from "@/locales/cs/devices";
import csInvoices from "@/locales/cs/invoices";
import csItems from "@/locales/cs/items";
import csLanding from "@/locales/cs/landing";
import csMenus from "@/locales/cs/menus";
import csNavigation from "@/locales/cs/navigation";
import csPayments from "@/locales/cs/payments";
import csPos from "@/locales/cs/pos";
import csReservations from "@/locales/cs/reservations";
import csSettings from "@/locales/cs/settings";
import csTables from "@/locales/cs/tables";
import csTransactions from "@/locales/cs/transactions";
import csWaiters from "@/locales/cs/waiters";
import enAccounts from "@/locales/en/accounts";
import enAdmin from "@/locales/en/admin";
import enApp from "@/locales/en/app";
import enAuth from "@/locales/en/auth";
import enBills from "@/locales/en/bills";
import enCategories from "@/locales/en/categories";
import enClient from "@/locales/en/client";
import enCommon from "@/locales/en/common";
import enComponents from "@/locales/en/components";
import enContacts from "@/locales/en/contacts";
import enDevices from "@/locales/en/devices";
import enInvoices from "@/locales/en/invoices";
import enItems from "@/locales/en/items";
import enLanding from "@/locales/en/landing";
import enMenus from "@/locales/en/menus";
import enNavigation from "@/locales/en/navigation";
import enPayments from "@/locales/en/payments";
import enPos from "@/locales/en/pos";
import enReservations from "@/locales/en/reservations";
import enSettings from "@/locales/en/settings";
import enTables from "@/locales/en/tables";
import enTransactions from "@/locales/en/transactions";
import enWaiters from "@/locales/en/waiters";

export const resources = {
	en: {
		common: enCommon,
		app: enApp,
		auth: enAuth,
		admin: enAdmin,
		client: enClient,
		settings: enSettings,
		accounts: enAccounts,
		categories: enCategories,
		contacts: enContacts,
		devices: enDevices,
		items: enItems,
		menus: enMenus,
		invoices: enInvoices,
		payments: enPayments,
		bills: enBills,
		tables: enTables,
		waiters: enWaiters,
		transactions: enTransactions,
		reservations: enReservations,
		landing: enLanding,
		navigation: enNavigation,
		components: enComponents,
		pos: enPos,
	},
	cs: {
		common: csCommon,
		app: csApp,
		auth: csAuth,
		admin: csAdmin,
		client: csClient,
		settings: csSettings,
		accounts: csAccounts,
		categories: csCategories,
		contacts: csContacts,
		devices: csDevices,
		items: csItems,
		menus: csMenus,
		invoices: csInvoices,
		payments: csPayments,
		bills: csBills,
		tables: csTables,
		waiters: csWaiters,
		transactions: csTransactions,
		reservations: csReservations,
		landing: csLanding,
		navigation: csNavigation,
		components: csComponents,
		pos: csPos,
	},
} as const;
