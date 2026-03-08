import type { BillDriver } from "@/lib/bill/driver";
import { ExampleBillDriver } from "@/lib/bill/drivers/example-bill-driver";
import { LnDriver } from "@/lib/bill/drivers/ln-driver";
import { MenuDriver } from "@/lib/bill/drivers/menu-driver";
import { ReservationDriver } from "@/lib/bill/drivers/reservation-driver";
import { StaticPaymentBillDriver } from "@/lib/bill/drivers/static-payment-bill-driver";
import { TableDriver } from "@/lib/bill/drivers/table-driver";

class BillManager implements BillDriver {
	private readonly billDrivers: BillDriver[] = [
		new StaticPaymentBillDriver(),
		new ExampleBillDriver(),
		new MenuDriver(),
		new ReservationDriver(),
		new TableDriver(),
		new LnDriver(),
	];

	public async subscribe(params: Parameters<BillDriver["subscribe"]>[0]) {
		for (const billDriver of this.billDrivers) {
			const subscription = await billDriver.subscribe(params);
			if (subscription !== null) {
				return subscription;
			}
		}

		return null;
	}
}

export const billManager = new BillManager();
