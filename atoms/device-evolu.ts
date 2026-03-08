import { atom } from "jotai";
import { createDeviceEvolu } from "@/lib/evolu/device";

export const deviceEvoluAtom = atom(async () => {
	const deviceEvolu = await createDeviceEvolu();

	return deviceEvolu;
});
