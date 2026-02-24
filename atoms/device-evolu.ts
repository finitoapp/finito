import { atom } from "jotai";
import { createDeviceEvolu } from "@/lib/evolu/device";

export const deviceEvoluAtom = atom(async () => {
	const deviceEvolu = createDeviceEvolu();

	return deviceEvolu;
});
