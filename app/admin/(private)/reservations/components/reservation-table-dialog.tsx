"use client";

import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { TableForm } from "@/app/admin/(private)/tables/table-form";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export const ReservationTableDialog: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(props.stateAtoms.tableDialogOpenAtom);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>{t("tables:page.newTable")}</DialogTitle>
				</DialogHeader>
				{open && <TableForm onSuccess={() => setOpen(false)} />}
			</DialogContent>
		</Dialog>
	);
};
