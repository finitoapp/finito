import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import type { Evolu } from "@/lib/evolu";

export type EvoluDep = {
	evolu: Evolu;
};

export type DeviceEvoluDep = {
	deviceEvolu: DeviceEvoluDep;
};

export type NdkDep = {
	ndk: NDK & {
		signer: NDKSigner;
		activeUser: NDKUser;
	};
};
