"use client";

import { useRouter } from "next/navigation";
import { type FC, useEffect, useEffectEvent, useState } from "react";
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
import { Uuid7 } from "@/lib/shared/types";
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
	screen: ScreenData | null;
}> = (props) => {
	if (props.screen === null) {
		return null;
	}

	const Component = screenComponents[props.screen.variant];
	if (Component === undefined) {
		return null;
	}

	return <Component screen={props.screen}></Component>;
};

export default function Page() {
	const { t } = useTranslation();
	const [sessionId, setSessionId] = useState<Uuid7 | null>(null);
	const router = useRouter();
	const { ndk } = useNostr();
	const fallbackScreen: ScreenData = {
		variant: "loading",
		payload: {
			text: t("client:paymentPage.loading.loadingData"),
		},
	};
	const [screens, setScreens] = useState<ScreenData[]>([fallbackScreen]);
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

		if (qrCode === null || sessionId === null) {
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
							return;
						}

						setScreens((screens) => [...screens, screen]);
					},
					replace: (screen: ScreenData) => {
						if (finished) {
							return;
						}

						setScreens((screens) => [...screens.slice(0, -1), screen]);
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
	}, [qrCode, ndk, sessionId, router, t]);

	useOnMountUnsafe(() => {
		(async () => {
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
			setSessionId(Uuid7.random());
		})();
	});

	const screen = screens[screens.length - 1] ?? fallbackScreen;

	return (
		<div className="w-full flex flex-col justify-between min-h-full">
			<div className={"h-24"} />
			<FadeHeader
				title={
					screen.variant === "payment"
						? screen.payload.merchant?.name
						: "Restaurace v pangejtu"
				}
				customStartAddonOnClick={() => {
					if (screens.length > 1) {
						setScreens((screens) => screens.slice(0, -1));
						return;
					}

					router.replace("/");
				}}
			/>

			<Screen screen={screen} />

			{/*<BottomPanel*/}
			{/*	subscription={subscription}*/}
			{/*	screen={screen}*/}
			{/*	selectedItemsAtom={selectedItemsAtom}*/}
			{/*	selectedTipAtom={selectedTipAtom}*/}
			{/*	loadingAtom={loadingAtom}*/}
			{/*/>*/}
		</div>
	);
}
