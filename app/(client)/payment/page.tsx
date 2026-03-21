"use client";

import { type Atom, atom, useAtomValue, useStore } from "jotai";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useEffectEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { InfoScreen } from "@/app/(client)/payment/components/info-screen";
import { LoadingScreen } from "@/app/(client)/payment/components/loading-screen";
import { MenuScreen } from "@/app/(client)/payment/components/menu-screen";
import { PaymentScreen } from "@/app/(client)/payment/components/payment-screen";
import { ReservationScreen } from "@/app/(client)/payment/components/reservation-screen";
import { TableScreen } from "@/app/(client)/payment/components/table-screen";
import { FadeHeader } from "@/components/fade-header";
import { useNostr } from "@/hooks/use-nostr";
import { useOnMountUnsafe } from "@/hooks/use-on-mount-unsafe";
import type {
	BillDriverSubscriptionEvent,
	BillSubscription,
	ScreenData,
} from "@/lib/bill/driver";
import { billManager } from "@/lib/bill/manager";
import { assertNever } from "@/lib/shared/utils/type";

const screenComponents = {
	payment: PaymentScreen,
	table: TableScreen,
	menu: MenuScreen,
	reservation: ReservationScreen,
	loading: LoadingScreen,
	info: InfoScreen,
} as Record<ScreenData["variant"], React.FC<{ screen: ScreenData }>>;

const Screen: FC<{
	screenAtom: Atom<ScreenData>;
	onHeaderBackClick?: () => void;
}> = (props) => {
	const screen = useAtomValue(props.screenAtom);

	const Component = screenComponents[screen.variant];
	if (Component === undefined) {
		return null;
	}

	return (
		<>
			<FadeHeader
				title={
					screen.variant === "payment" || screen.variant === "table"
						? screen.payload.merchant?.name
						: "Restaurace v pangejtu"
				}
				customStartAddonOnClick={props.onHeaderBackClick}
			/>

			{Component && <Component screen={screen}></Component>}
		</>
	);
};

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const { ndk } = useNostr();
	const jotaiStore = useStore();
	const fallbackScreen: Atom<ScreenData> = useMemo(
		() =>
			atom({
				variant: "loading",
				payload: {
					text: t("client:paymentPage.loading.loadingData"),
				},
			}),
		[t],
	);
	const [screens, setScreens] = useState<Atom<ScreenData>[]>(() => [
		fallbackScreen,
	]);
	const [qrCode, setQrCode] = useState<string | null>(null);

	const subscriptionHandler = useEffectEvent(
		async (event: BillDriverSubscriptionEvent) => {
			if (event.type === "close") {
				alert(event.payload.alertMessage);
				router.replace("/");
				return;
			}

			assertNever(event.type);
		},
	);

	useEffect(() => {
		let finished = false;
		let subscriptionPromise: Promise<null | BillSubscription> =
			Promise.resolve(null);

		if (qrCode === null) {
			return;
		}

		(async () => {
			subscriptionPromise = billManager.subscribe({
				ndk,
				t,
				billId: qrCode,
				callback: async (event) => {
					if (finished) {
						return;
					}

					await subscriptionHandler(event);
				},
				screenStack: {
					back: () => {
						if (finished) {
							return;
						}

						setScreens((screens) => screens.slice(0, -1));
					},
					push: (screen: ScreenData) => {
						if (finished) {
							return {
								replace: () => {},
							};
						}

						const screenAtom = atom(screen);
						setScreens((screens) => [...screens, screenAtom]);

						return {
							replace: (screen: ScreenData) => {
								jotaiStore.set(screenAtom, screen);
							},
						};
					},
					replaceLast: (screen: ScreenData) => {
						if (finished) {
							return {
								replace: () => {},
							};
						}

						const screenAtom = atom(screen);
						setScreens((screens) => [...screens.slice(0, -1), screenAtom]);

						return {
							replace: (screen: ScreenData) => {
								jotaiStore.set(screenAtom, screen);
							},
						};
					},
				},
			});

			const subscription = await subscriptionPromise;
			if (finished) {
				return;
			}

			if (subscription === null) {
				alert(t("client:paymentPage.alerts.unknownQrCode"));
				router.replace("/");
				return;
			}
		})();

		return () => {
			finished = true;

			if (subscriptionPromise !== null) {
				subscriptionPromise.then((subscription) => {
					if (subscription === null) {
						return;
					}

					return subscription.close();
				});
			}
		};
	}, [qrCode, ndk, router, t, jotaiStore.set]);

	useOnMountUnsafe(() => {
		(() => {
			const hash = (() => {
				const [hash, ...rest] = decodeURIComponent(window.location.hash)
					.replace(/^#/, "")
					.split("#");

				if (rest.length === 0) {
					return hash;
				}

				return rest.join("#");
			})();

			setQrCode(hash);
		})();
	});

	const screen = screens[screens.length - 1] ?? fallbackScreen;

	return (
		<div className="w-full flex flex-col justify-between min-h-full">
			<div className={"h-24"} />
			<Screen
				screenAtom={screen}
				onHeaderBackClick={() => {
					if (screens.length > 1) {
						setScreens((screens) => screens.slice(0, -1));
						return;
					}

					router.replace("/");
				}}
			/>
		</div>
	);
}
