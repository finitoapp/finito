import { atom } from "jotai";
import { createDeviceEvolu } from "@/lib/device-evolu";

export const deviceEvoluAtom = atom(async () => {
	const deviceEvolu = createDeviceEvolu();

	return deviceEvolu;
});
