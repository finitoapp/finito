const locale = {
	"table": {
		"description": {
			"listOfBills": "Overview of open point-of-sale bills",
		},
		"columns": {
			"bill": "Bill",
			"createdAt": "Created at",
			"label": "Label",
			"table": "Table",
			"amount": "Amount",
		},
	},
	"detail": {
		"tabs": {
			"sections": "Sections",
			"detail": "Detail",
			"history": "History",
		},
		"stats": {
			"total": "Total",
			"currency": "Currency",
			"items": "Items",
		},
		"fields": {
			"bill": "Bill",
			"label": "Label",
			"table": "Table",
			"device": "Device",
			"createdAt": "Created at",
		},
		"sections": {
			"items": "Bill items",
			"exchangeRates": "Exchange rates",
		},
		"actions": {
			"openInPos": "Open in POS",
			"openTable": "Open table",
		},
		"empty": {
			"items": "The bill does not contain any items yet.",
		},
		"items": {
			"columns": {
				"item": "Item",
				"quantity": "Quantity",
				"total": "Total",
			},
		},
		"history": {
			"columns": {
				"createdAt": "Changed at",
				"item": "Item",
				"type": "Change type",
				"quantity": "Quantity",
				"amount": "Amount",
			},
			"type": {
				"add": "Add",
				"remove": "Remove",
			},
		},
		"rates": {
			"columns": {
				"currency": "Currency",
				"rate": "Rate",
			},
		},
	},
} as const;

export default locale;
