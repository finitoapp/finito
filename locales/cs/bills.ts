const locale = {
	"table": {
		"description": {
			"listOfBills": "Přehled otevřených účtů v pokladně",
		},
		"columns": {
			"bill": "Účet",
			"createdAt": "Vytvořeno",
			"label": "Název",
			"table": "Stůl",
			"amount": "Částka",
		},
	},
	"detail": {
		"tabs": {
			"sections": "Sekce",
			"detail": "Detail",
			"history": "Historie",
		},
		"stats": {
			"total": "Celkem",
			"currency": "Měna",
			"items": "Položky",
		},
		"fields": {
			"bill": "Účet",
			"label": "Název",
			"table": "Stůl",
			"device": "Zařízení",
			"createdAt": "Vytvořeno",
		},
		"sections": {
			"items": "Položky účtu",
			"exchangeRates": "Kurzy",
		},
		"actions": {
			"openInPos": "Otevřít v pokladně",
			"openTable": "Otevřít stůl",
		},
		"empty": {
			"items": "Účet zatím neobsahuje žádné položky.",
		},
		"items": {
			"columns": {
				"item": "Položka",
				"quantity": "Množství",
				"total": "Celkem",
			},
		},
		"history": {
			"columns": {
				"createdAt": "Změněno",
				"item": "Položka",
				"type": "Typ změny",
				"quantity": "Množství",
				"amount": "Částka",
			},
			"type": {
				"add": "Přidání",
				"remove": "Odebrání",
			},
		},
		"rates": {
			"columns": {
				"currency": "Měna",
				"rate": "Kurz",
			},
		},
	},
} as const;

export default locale;
