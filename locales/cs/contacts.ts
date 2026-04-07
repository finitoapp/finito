const locale = {
	page: {
		editContact: "Upravit kontakt",
		newContact: "Nový kontakt",
		tabsSections: "Sekce",
	},
	table: {
		contacts: "Kontakty",
		listOfYourContacts: "Seznam vašich kontaktů",
		actions: {
			"new-contact": "Nový kontakt",
		},
		columns: {
			name: "Jméno",
			phone: "Telefon",
			"identification-number": "IČO",
			"vat-number": "DIČ",
		},
		search: {
			placeholder: {
				"by-name": "Hledat podle jména...",
				"by-name-or-label": "Hledat podle jména nebo štítku...",
			},
		},
	},
	form: {
		"contact-form": {
			label: {
				"contact-name": "Jméno kontaktu",
				label: "Štítek",
				email: "E-mail",
				phone: "Telefon",
				street: "Ulice",
				"descriptive-number": "Číslo popisné",
				city: "Město",
				"postal-code": "PSČ",
				"country-code": "Kód země",
				"identification-number": "IČO",
				"vat-number": "DIČ",
				"case-number": "Spisová značka",
			},
			description: {
				"your-private-name-for-internal-purposes":
					"Váš interní název pro soukromé použití",
			},
		},
	},
	detail: {
		tabs: {
			sections: "Sekce",
			detail: "Detail",
			history: "Historie",
		},
		cards: {
			phone: "Telefon",
			vatNumber: "DIČ",
			modifiedAt: "Upraveno",
		},
		fields: {
			name: "Jméno kontaktu",
			street: "Ulice",
			city: "Město",
			postalCode: "PSČ",
			country: "Země",
			vatNumber: "DIČ",
			identificationNumber: "IČO",
			email: "E-mail",
			phone: "Telefon",
		},
		actions: {
			edit: "Upravit",
			delete: "Smazat",
		},
		deleteDialog: {
			title: "Smazat kontakt?",
			description: "Tuto akci nelze vrátit zpět.",
			confirm: "Smazat",
			cancel: "Zrušit",
		},
	},
} as const;

export default locale;
