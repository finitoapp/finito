"use client";

import { DefautLayout } from "@/app/admin/defaut-layout";

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	return <DefautLayout title={"Accounts"}>{props.children}</DefautLayout>;
}
