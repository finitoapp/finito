const locale = {
	"page": {
		"calendar": {
			"title": "Kalendář rezervací",
			"description": "Správa rezervací po stolech v denním pohledu.",
			"tableColumn": "Stůl",
			"zoomHorizontal": "Horiz. zoom {{percent}} %",
			"zoomVertical": "Vert. zoom {{percent}} %",
			"seatsFilter": "Min. míst",
			"seatsMin": "např. 6",
			"collisionWarning": "Byly nalezeny překryvy rezervací na stejném stole ({{count}}).",
			"collisionAction": "Přejít na kolizi",
			"capacityWarning": "Byly nalezeny rezervace nad kapacitou stolu ({{count}}).",
			"capacityAction": "Přejít na problém",
			"approvedWithoutTableWarning": "Byly nalezeny budoucí schválené rezervace bez přiřazeného stolu ({{count}}).",
			"approvedWithoutTableAction": "Upravit rezervaci",
			"noTablesWarning": "Neexistuje žádný stůl. Pro práci s timeline nejdřív vytvořte stůl.",
			"selectedTimezone": "Časové pásmo: {{timezone}}",
			"unassigned": {
				"title": "Nezařazené rezervace",
				"empty": "Pro tento den nejsou žádné nezařazené rezervace."
			}
		},
		"operations": {
			"title": "Operativa",
			"pendingTitle": "Čekající na schválení",
			"pendingEmpty": "Nejsou žádné budoucí čekající rezervace.",
			"invalidTitle": "Nevalidní rezervace (schválené bez stolu)",
			"nearestTitle": "Nejbližší rezervace",
			"nearestEmpty": "Nejsou žádné blízké rezervace.",
			"seatedTitle": "Usazené rezervace",
			"seatedEmpty": "Nejsou žádné usazené rezervace."
		},
		"details": {
			"title": "Detail rezervace",
			"back": "Zpět na operativu",
			"time": "Čas",
			"quickActions": "Rychlé akce",
			"notFound": "Vybraná rezervace už neexistuje."
		},
		"actions": {
			"newReservation": "Nová rezervace",
			"addTable": "Přidat stůl",
			"newUnassignedReservation": "Nová bez stolu",
			"moveReservation": "Posunout",
			"resizeReservation": "Změnit délku",
			"approveReservation": "Schválit",
			"rejectReservation": "Zamítnout",
			"assignTable": "Přiřadit stůl",
			"markSeated": "Označit usazení",
			"markCompleted": "Označit dokončení",
			"markNoShow": "Označit nedorazili",
			"edit": "Upravit",
			"previousDay": "Předchozí den",
			"nextDay": "Další den",
			"pickDay": "Vybrat den"
		},
		"form": {
			"newTitle": "Nová rezervace",
			"editTitle": "Upravit rezervaci"
		},
		"delete": {
			"title": "Smazat rezervaci?",
			"description": "Tuto akci nelze vrátit zpět.",
			"confirm": "Smazat",
			"cancel": "Zrušit"
		},
		"dragConfirm": {
			"title": "Uložit přesun rezervace?",
			"description": "Rezervace bude přesunuta na novou pozici.",
			"timeChange": "Čas: {{from}} -> {{to}}",
			"tableChange": "Stůl: {{from}} -> {{to}}",
			"confirm": "Uložit",
			"cancel": "Zrušit"
		}
	},
	"form": {
		"fields": {
			"id": "ID",
			"_tag": "Typ",
			"name": "Jméno",
			"phone": "Telefon",
			"email": "E-mail",
			"label": "Název blokace",
			"note": "Poznámka",
			"numberOfPeople": "Počet osob",
			"approvalStatus": "Stav schválení",
			"serviceStatus": "Provozní stav",
			"statusReason": "Důvod stavu",
			"source": "Zdroj",
			"tableId": "Stůl",
			"startAtLocal": "Začátek",
			"durationMinutes": "Délka (min)"
		},
		"approval": {
			"pending": "Čeká",
			"approved": "Schváleno",
			"rejected": "Zamítnuto"
		},
		"service": {
			"upcoming": "Naplánováno",
			"seated": "Usazeni",
			"completed": "Dokončeno",
			"noShow": "Nedorazili"
		},
		"source": {
			"manual": "Manuálně",
			"phone": "Telefon",
			"web": "Web"
		},
		"tag": {
			"reservationBooking": "Rezervace",
			"reservationBlock": "Blokace"
		},
		"table": {
			"unassigned": "Bez stolu"
		}
	}
} as const;

export default locale;
