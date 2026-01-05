"use client";

import { HandCoinsIcon, ReceiptIcon, User } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHash } from "@/hooks/use-hash";

const navItems: {
	href: Route;
	icon: React.FC<{ className: string }>;
	label: React.ReactNode;
}[] = [
	{
		href: "/",
		icon: HandCoinsIcon,
		label: "Pay",
	},
	{
		href: "/history",
		icon: ReceiptIcon,
		label: "Payment history",
	},
	{
		href: "/settings",
		icon: User,
		label: "Settings",
	},
];

export function Nav() {
	const pathname = usePathname();
	const hash = useHash();
	const paths = pathname.split("/");

	return (
		<div
			className="fixed bg-background border-t safe-area-pb z-50 max-w-xl rounded-full shadow-2xl transition-all duration-400"
			style={{
				bottom:
					pathname === "/payment" || paths.length > 2 || hash !== null
						? -80
						: "max(env(safe-area-inset-bottom, 0px), 8px)",
			}}
		>
			<div className="relative max-w-md mx-auto">
				<div className="flex items-end justify-around gap-2">
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive =
							pathname === item.href ||
							(item.href !== "/" && pathname.startsWith(item.href));

						return (
							<Link key={item.href} href={item.href}>
								<button
									type={"button"}
									className={`flex flex-1 flex-col items-center justify-center transition-all duration-200 py-3 ${isActive ? "scale-110" : "scale-100"}`}
								>
									<div
										className={`flex items-center justify-center rounded-full transition-all duration-300 ${`w-6 h-6 ${isActive ? "text-primary" : "text-muted-foreground"}`}`}
									>
										<Icon className={`w-5 h-5`} />
									</div>
									<span
										className={`z-20 w-24 text-[11px] font-bold pt-1 transition-colors duration-200 ${
											isActive ? "text-primary" : "text-muted-foreground"
										}`}
									>
										{item.label}
									</span>
								</button>
							</Link>
						);
					})}
				</div>
			</div>
		</div>
	);
}
