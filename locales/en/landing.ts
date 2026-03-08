const locale = {
	"page": {
		"hero": {
			"eyebrow": "Local-first platform for payments and operations",
			"finitoClaim1": "Say Finito to unnecessarily complex payment infrastructure.",
			"finitoClaim2": "Say Finito to fragmented tools for invoicing and daily operations.",
			"finitoClaim3": "Say Finito to third-party dependency as a business model.",
			"finitoClaim4": "Keep your operations, data, and finances under your control.",
			"title": "A practical platform for day-to-day business workflows.",
			"subtitle":
				"One product for customer payments and business operations. Core usage is free and works directly in the browser, no installation required.",
			"ctaClient": "Open client",
			"ctaAdmin": "Open admin",
			"ctaGithub": "GitHub",
			"ctaX": "X / Twitter",
			"note": "An optional desktop version is available via Tauri.",
		},
		"perspectives": {
			"title": "Two perspectives, one system",
			"subtitle":
				"Customers need fast checkout. Businesses need full operations. Both get what they need.",
			"clientTitle": "For customers (client)",
			"clientLead":
				"Fast QR payments, clear flow, and payment history without friction.",
			"clientPoint1": "Scan a QR code and start paying immediately.",
			"clientPoint2":
				"Review bill items, add tip, and confirm the payment result.",
			"clientPoint3": "See payment history and transaction details.",
			"clientPoint4":
				"Manage account basics, connected wallets, language, and app appearance.",
			"businessTitle": "For businesses (admin)",
			"businessLead":
				"From POS to invoices to table reservations. One place instead of five disconnected tools.",
			"businessPoint1":
				"Run POS workflows, monitor payments, and keep operations in sync.",
			"businessPoint2":
				"Handle invoices plus clients, items, categories, and table management.",
			"businessPoint3":
				"Use a table-based reservation timeline with collisions, capacity checks, and operations context.",
			"businessPoint4":
				"Configure plugins, accounts, and business settings in a single admin space.",
		},
		"how": {
			"title": "How it works in real life",
			"step1Title": "1) Business prepares the bill",
			"step1Body":
				"Create the bill in admin or POS. No magic, just a clear first step.",
			"step2Title": "2) Customer pays in client",
			"step2Body":
				"Scan QR, review the bill, confirm payment. Done in moments.",
			"step3Title": "3) Operations continue",
			"step3Body":
				"The business sees payment records and can continue with reservations, invoicing, and daily operations.",
		},
		"localFirst": {
			"title": "Why local-first matters",
			"lead":
				"Business data should stay under the operator's control and remain available long-term.",
			"point1Title": "Data ownership",
			"point1Body":
				"Core business records stay under the operator's control, not trapped in a closed SaaS.",
			"point2Title": "Open-source transparency",
			"point2Body":
				"Code is auditable, changes are visible, and architecture decisions stay accountable.",
			"point3Title": "Sync without central lock-in",
			"point3Body": "Synchronization is handled through Evolu relays.",
		},
		"roadmap": {
			"title": "What is done vs. what is next",
			"lead": "Current project status and the next planned steps.",
			"now1":
				"Now: payments, POS, invoices, core data management, and reservation workflows.",
			"now2":
				"Now: client flow for scan-to-pay, history, and self-service settings.",
			"next1":
				"Next: stronger operations automation and expanded reservation scenarios.",
			"next2":
				"Next: additional commerce modules (for example order payments and payment widgets/paywalls).",
		},
		"faq": {
			"title": "Frequently asked questions",
			"q1": "Is Finito free?",
			"a1": "Yes. Finito is open-source and core usage is free.",
			"q2": "Do I need to install anything?",
			"a2":
				"No. Finito works directly in the browser. A desktop app is optional.",
			"q3": "Is it usable today?",
			"a3":
				"Yes. It is usable for development and real-world operational testing, while still actively evolving.",
			"q4": "How are data and synchronization handled?",
			"a4":
				"The system is local-first and synchronization is handled through Evolu relays.",
		},
		"media": {
			"title": "Where to follow progress",
			"githubTitle": "GitHub",
			"githubBody":
				"Source code, issues, and real project activity without unnecessary marketing filters.",
			"xTitle": "X / Twitter",
			"xBody": "Short updates, release notes, and product updates.",
			"githubCta": "Open repository",
			"xCta": "Follow profile",
			"screensTitle": "Current project screenshots",
			"screenshot1Alt": "Finito admin dashboard",
			"screenshot2Alt": "Finito payments and invoices",
			"screenshot3Alt": "Finito client app",
		},
		"footer": {
			"title": "One platform for payments and operations.",
			"body":
				"If you want a practical setup with strong data ownership and simple daily use, this is built for you.",
		},
	},
} as const;

export default locale;
