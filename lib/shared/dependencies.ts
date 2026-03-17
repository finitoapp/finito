import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import type { Evolu } from "@/lib/evolu";
import type { DeviceEvolu } from "@/lib/evolu/device";

export type EvoluDep = {
	evolu: Evolu;
};

export type DeviceEvoluDep = {
	deviceEvolu: DeviceEvolu;
};

export type NdkDep = {
	ndk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
};
