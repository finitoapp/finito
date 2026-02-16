const locale = {
	"page": {
		"hero": {
			"eyebrow": "Local-first platforma pro platby a provoz",
			"finitoClaim1": "Řekněte Finito složité platební infrastruktuře.",
			"finitoClaim2": "Řekněte Finito roztříštěným nástrojům pro fakturaci a provoz.",
			"finitoClaim3": "Řekněte Finito závislosti na třetích stranách.",
			"finitoClaim4": "Mějte pod kontrolou provoz, data i finance.",
			"title": "Jednoduché řešení pro každodenní provoz.",
			"subtitle":
				"Jedna aplikace pro zákazníka i podnik. Základní používání je zdarma a běží přímo v prohlížeči, bez instalace.",
			"ctaClient": "Otevřít klienta",
			"ctaAdmin": "Otevřít admin",
			"ctaGithub": "GitHub",
			"ctaX": "X / Twitter",
			"note": "Volitelně je k dispozici i desktopová varianta přes Tauri.",
		},
		"perspectives": {
			"title": "Dva pohledy, jeden systém",
			"subtitle":
				"Zákazník řeší rychlou platbu. Podnik řeší celý provoz. Každý dostane to své.",
			"clientTitle": "Pro zákazníka (client)",
			"clientLead":
				"Rychlé zaplacení přes QR, jasný průběh, historie plateb bez zbytečných kroků.",
			"clientPoint1": "Sken QR kódu a okamžitý start platby.",
			"clientPoint2":
				"Přehled položek účtu, spropitné a potvrzení výsledku platby.",
			"clientPoint3": "Historie plateb a detail transakcí.",
			"clientPoint4":
				"Nastavení účtu, připojené peněženky, jazyk a vzhled aplikace.",
			"businessTitle": "Pro podnik (admin)",
			"businessLead":
				"Od POS přes faktury až po rezervace stolů. Jedno prostředí místo pěti nástrojů.",
			"businessPoint1":
				"POS provoz, přehled plateb a návazné workflow s účty.",
			"businessPoint2": "Fakturace a správa klientů, položek, kategorií a stolů.",
			"businessPoint3":
				"Rezervační timeline po stolech včetně kolizí, kapacit a operativního panelu.",
			"businessPoint4":
				"Nastavení pluginů, účtů a provozních údajů v rámci jedné administrace.",
		},
		"how": {
			"title": "Jak to funguje v praxi",
			"step1Title": "1) Podnik připraví účet",
			"step1Body":
				"V adminu nebo POS vznikne účet a částka. Žádné kouzlo, jen jasný krok.",
			"step2Title": "2) Zákazník zaplatí v clientu",
			"step2Body":
				"Naskenuje QR, zkontroluje položky a potvrdí platbu. Hotovo během chvíle.",
			"step3Title": "3) Provoz pokračuje",
			"step3Body":
				"Podnik má platbu v evidenci, navazuje rezervacemi, fakturou nebo další operativou.",
		},
		"localFirst": {
			"title": "Proč local-first",
			"lead":
				"Data o tvém provozu mají zůstat pod tvou kontrolou a být dostupná i dlouhodobě.",
			"point1Title": "Vlastnictví dat",
			"point1Body":
				"Core data zůstávají pod kontrolou provozovatele, ne uzamčená v cizím SaaS.",
			"point2Title": "Open-source transparentnost",
			"point2Body":
				"Kód je auditovatelný, změny viditelné a rozhodnutí obhajitelné.",
			"point3Title": "Sync bez centrální závislosti",
			"point3Body": "Synchronizace je řešená přes Evolu relays.",
		},
		"roadmap": {
			"title": "Co je hotové a co dál",
			"lead": "Aktuální stav projektu a plán dalších kroků.",
			"now1": "Dnes: platby, POS, faktury, správa dat a rezervační agenda.",
			"now2":
				"Dnes: client flow pro skenování, platbu, historii i základní self-service nastavení.",
			"next1":
				"Dále: silnější automatizace provozu a rozšíření rezervačních scénářů.",
			"next2":
				"Dále: další obchodní moduly (např. order payments, payment widgets/paywalls).",
		},
		"faq": {
			"title": "Časté dotazy",
			"q1": "Je Finito zdarma?",
			"a1": "Ano, projekt je open-source a základní používání je zdarma.",
			"q2": "Musím něco instalovat?",
			"a2":
				"Ne. Finito funguje přímo v prohlížeči. Desktopová aplikace je volitelná.",
			"q3": "Je to už použitelné?",
			"a3":
				"Ano, projekt je použitelný pro vývoj i reálné testování provozu a dál se aktivně vyvíjí.",
			"q4": "Jak je řešená data a synchronizace?",
			"a4":
				"Systém je local-first a synchronizace je řešená přes Evolu relays.",
		},
		"media": {
			"title": "Kde sledovat dění",
			"githubTitle": "GitHub",
			"githubBody":
				"Zdrojáky, issue a reálný vývoj bez zbytečného marketingového filtru.",
			"xTitle": "X / Twitter",
			"xBody": "Krátké novinky, release poznámky a produktové update.",
			"githubCta": "Otevřít repozitář",
			"xCta": "Sledovat profil",
			"screensTitle": "Aktuální screenshoty projektu",
			"screenshot1Alt": "Finito admin dashboard",
			"screenshot2Alt": "Finito platby a faktury",
			"screenshot3Alt": "Finito client aplikace",
		},
		"footer": {
			"title": "Jedna platforma pro platby i provoz.",
			"body":
				"Pokud hledáš praktické řešení s důrazem na data ownership a jednoduché každodenní používání, jsi na správném místě.",
		},
	},
} as const;

export default locale;
