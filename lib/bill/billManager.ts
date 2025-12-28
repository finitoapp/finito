import type { BillDriver } from "@/lib/bill/billDriver";
import { ExampleBillDriver } from "@/lib/bill/driver/exampleBillDriver";
import { StaticPaymentBillDriver } from "@/lib/bill/driver/staticPaymentBillDriver";
import { TableDriver } from "@/lib/bill/driver/tableDriver";

class BillManager implements BillDriver {
	private readonly billDrivers: BillDriver[] = [
		new StaticPaymentBillDriver(),
		new ExampleBillDriver(),
		new TableDriver(),
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
