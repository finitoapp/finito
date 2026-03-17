const locale = {
	page: {
		editContact: "Edit contact",
		newContact: "New contact",
	},
	table: {
		contacts: "Contacts",
		listOfYourContacts: "List of your contacts",
		actions: {
			"new-contact": "New contact",
		},
		columns: {
			name: "Name",
			phone: "Phone",
			"identification-number": "Identification Number",
			"vat-number": "VAT Number",
		},
		search: {
			placeholder: {
				"by-name": "Search by name...",
				"by-name-or-label": "Search by name or label...",
			},
		},
	},
	form: {
		"contact-form": {
			label: {
				"contact-name": "Contact name",
				label: "Label",
				email: "Email",
				phone: "Phone",
				street: "Street",
				"descriptive-number": "Descriptive Number",
				city: "City",
				"postal-code": "Postal Code",
				"country-code": "Country code",
				"identification-number": "Identification Number",
				"vat-number": "VAT Number",
				"case-number": "Case Number",
			},
			description: {
				"your-private-name-for-internal-purposes":
					"Your private name for internal purposes",
			},
		},
	},
	detail: {
		cards: {
			phone: "Phone",
			vatNumber: "VAT Number",
			modifiedAt: "Modified at",
		},
		fields: {
			name: "Contact name",
			street: "Street",
			city: "City",
			postalCode: "Postal Code",
			country: "Country",
			vatNumber: "VAT Number",
			identificationNumber: "Identification Number",
			email: "E-mail",
			phone: "Phone",
		},
		actions: {
			edit: "Edit",
			delete: "Delete",
		},
		deleteDialog: {
			title: "Delete contact?",
			description: "This action cannot be undone.",
			confirm: "Delete",
			cancel: "Cancel",
		},
	},
} as const;

export default locale;
