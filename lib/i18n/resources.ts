import csAccounts from "@/locales/cs/accounts";
import csAdmin from "@/locales/cs/admin";
import csApp from "@/locales/cs/app";
import csAuth from "@/locales/cs/auth";
import csCategories from "@/locales/cs/categories";
import csClient from "@/locales/cs/client";
import csClients from "@/locales/cs/clients";
import csCommon from "@/locales/cs/common";
import csComponents from "@/locales/cs/components";
import csInvoices from "@/locales/cs/invoices";
import csItems from "@/locales/cs/items";
import csLanding from "@/locales/cs/landing";
import csNavigation from "@/locales/cs/navigation";
import csPayments from "@/locales/cs/payments";
import csPos from "@/locales/cs/pos";
import csReservations from "@/locales/cs/reservations";
import csSettings from "@/locales/cs/settings";
import csTables from "@/locales/cs/tables";
import enAccounts from "@/locales/en/accounts";
import enAdmin from "@/locales/en/admin";
import enApp from "@/locales/en/app";
import enAuth from "@/locales/en/auth";
import enCategories from "@/locales/en/categories";
import enClient from "@/locales/en/client";
import enClients from "@/locales/en/clients";
import enCommon from "@/locales/en/common";
import enComponents from "@/locales/en/components";
import enInvoices from "@/locales/en/invoices";
import enItems from "@/locales/en/items";
import enLanding from "@/locales/en/landing";
import enNavigation from "@/locales/en/navigation";
import enPayments from "@/locales/en/payments";
import enPos from "@/locales/en/pos";
import enReservations from "@/locales/en/reservations";
import enSettings from "@/locales/en/settings";
import enTables from "@/locales/en/tables";

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
		clients: enClients,
		items: enItems,
		invoices: enInvoices,
		payments: enPayments,
		tables: enTables,
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
		clients: csClients,
		items: csItems,
		invoices: csInvoices,
		payments: csPayments,
		tables: csTables,
		reservations: csReservations,
		landing: csLanding,
		navigation: csNavigation,
		components: csComponents,
		pos: csPos,
	},
} as const;
