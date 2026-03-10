export const DEFAULT_LANGUAGE = "en" as const;

export const SUPPORTED_LANGUAGES = ["en", "cs"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const I18N_NAMESPACES = [
	"common",
	"app",
	"auth",
	"admin",
	"client",
	"settings",
	"accounts",
	"categories",
	"clients",
	"contacts",
	"items",
	"menus",
	"invoices",
	"payments",
	"tables",
	"reservations",
	"landing",
	"navigation",
	"components",
	"pos",
] as const;

export type AppNamespace = (typeof I18N_NAMESPACES)[number];
export const I18N_DEFAULT_NAMESPACE: AppNamespace = "common";
