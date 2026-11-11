/**
 * Each native screen or screen part and the web file(s) that draw the same
 * thing, so a rebuilt screen can be checked against web (`ui-parity.test.ts`).
 * Native paths are relative to `apps/native-app`, web paths to the repo root.
 * A `matched` entry must render the same kit components as its web files,
 * apart from `allowedDifferences`, each with its reason.
 */

export interface UiParityEntry {
  readonly native: string
  /** Empty for a native-only part; `note` says why. */
  readonly web: ReadonlyArray<string>
  readonly note?: string
  readonly status: "pending" | "matched"
  /** Kit component name → why native differs from web there. */
  readonly allowedDifferences?: Readonly<Record<string, string>>
}

export const uiParityMap: ReadonlyArray<UiParityEntry> = [
  {
    native: "src/components/app/access-gate.tsx",
    web: ["apps/web-app/src/components/app/access-gate.tsx"],
    status: "matched",
    allowedDifferences: {
      FadeHeader:
        "Web adds this route header above the PIN screen; native renders the gated route inside its shared Screen layout.",
    },
  },
  {
    native: "src/components/app/app-background-jobs.tsx",
    web: ["apps/web-app/src/components/app/app-background-jobs.tsx"],
    status: "matched",
  },
  {
    native: "src/components/app/app-migrations.tsx",
    web: ["apps/web-app/src/components/app/app-migrations.tsx"],
    status: "matched",
  },
  {
    native: "src/components/app/app-error-screen.tsx",
    web: ["apps/web-app/src/components/app/error-boundary.tsx"],
    status: "matched",
    allowedDifferences: {
      Button:
        "Web uses kit buttons for copy, repair, and retry; native draws plain React Native copy and retry buttons in its root error boundary and has no repair (no service worker or cache to clear).",
      Card: "Web renders a rich error card; native uses plain React Native because Expo Router mounts this boundary outside the app providers.",
      CardContent:
        "Web renders a rich error card; native uses plain React Native because Expo Router mounts this boundary outside the app providers.",
      CardDescription:
        "Web renders a rich error card; native uses plain React Native because Expo Router mounts this boundary outside the app providers.",
      CardFooter:
        "Web renders a rich error card; native uses plain React Native because Expo Router mounts this boundary outside the app providers.",
      CardHeader:
        "Web renders a rich error card; native uses plain React Native because Expo Router mounts this boundary outside the app providers.",
      CardTitle:
        "Web renders a rich error card; native uses plain React Native because Expo Router mounts this boundary outside the app providers.",
      Collapsible:
        "Web exposes expandable technical details; native displays the available error name, message, and version inline.",
      CollapsibleContent:
        "Web exposes expandable technical details; native displays the available error name, message, and version inline.",
      CollapsibleTrigger:
        "Web exposes expandable technical details; native displays the available error name, message, and version inline.",
    },
  },
  {
    native: "src/components/app/app-loader.tsx",
    web: [],
    status: "matched",
    note: "Web's boot loader is the #app-loader markup in apps/web-app/index.html, not a TSX file; native draws the same centered app icon on the theme background.",
  },
  {
    native: "src/components/app/confirm-host.tsx",
    web: ["apps/web-app/src/components/app/confirm-dialog-host.tsx"],
    status: "matched",
  },
  {
    native: "src/components/app/demo-data-seed.tsx",
    web: ["apps/web-app/src/components/app/demo-data-seed.tsx"],
    status: "matched",
  },
  {
    native: "src/components/app/device-registration.tsx",
    web: ["apps/web-app/src/components/app/device-registration.tsx"],
    status: "matched",
  },
  {
    native: "src/components/app/pin-prompt-host.tsx",
    web: ["apps/web-app/src/components/app/pin-prompt-host.tsx"],
    status: "matched",
    allowedDifferences: {
      Dialog:
        "Native presents the one-shot prompt in a React Native Modal; web uses the Dialog primitive.",
      DialogContent:
        "Native presents the one-shot prompt in a React Native Modal; web uses the Dialog primitive.",
      DialogTitle:
        "Native presents the one-shot prompt in a React Native Modal; web uses the Dialog primitive.",
    },
  },
  {
    native: "src/components/app/pin-screen.tsx",
    web: ["apps/web-app/src/components/app/pin-screen.tsx"],
    status: "matched",
  },
  {
    native: "src/components/app/sentry-controller.tsx",
    web: ["apps/web-app/src/components/app/sentry-controller.tsx"],
    status: "matched",
  },
  {
    native: "src/components/app/switchio-restored-result.tsx",
    web: ["apps/web-app/src/components/app/switchio-restored-result.tsx"],
    status: "matched",
  },
  {
    native: "src/components/app/switchio-restored-closure.tsx",
    web: [],
    note: "Finito only: web's Capacitor bridge takes card payments but cannot close the terminal's batch, so there is no closure to restore (payment/0008).",
    status: "matched",
  },
  {
    native: "src/components/app/switchio-restored-refund.tsx",
    web: [],
    note: "Finito only: web does not refund to the card through SwitchioPay, so there is no refund result to restore or attempt to ask about (refund/0007).",
    status: "matched",
  },
  {
    native: "src/components/app/toast-host.tsx",
    web: ["apps/web-app/src/components/ui/sonner.tsx"],
    status: "matched",
    allowedDifferences: {
      Toast: "Native renders its UI-kit Toast; web mounts the Sonner host.",
    },
  },
  {
    native: "src/components/collision-alert.tsx",
    web: ["apps/web-app/src/components/collision-alert.tsx"],
    status: "matched",
  },
  {
    native: "src/components/copy-link.tsx",
    web: [],
    note: "Native only: web copies through a Button inline.",
    status: "matched",
    allowedDifferences: {
      Button: "web inlines this ghost copy Button at each call site",
    },
  },
  {
    native: "src/components/copyable-qr-code.tsx",
    web: ["apps/web-app/src/components/copyable-qr-code.tsx"],
    status: "matched",
  },
  {
    native: "src/components/detail-row.tsx",
    web: ["apps/web-app/src/components/detail-row.tsx"],
    status: "matched",
  },
  {
    native: "src/components/fade-header.tsx",
    web: ["apps/web-app/src/components/fade-header.tsx"],
    status: "matched",
  },
  {
    native: "src/components/field.tsx",
    web: ["apps/web-app/src/components/ui/field.tsx"],
    status: "matched",
    allowedDifferences: {
      Field:
        "Native's app-level Field composes the input, label, and validation display.",
      FieldError:
        "Native's app-level Field composes the input, label, and validation display.",
      FieldLabel:
        "Native's app-level Field composes the input, label, and validation display.",
      Input:
        "Native's app-level Field composes the input, label, and validation display.",
      Label:
        "Web's field module renders Label inside FieldLabel; native uses the native FieldLabel primitive.",
      Separator:
        "Web's field module includes an optional FieldSeparator; native's single-field app helper has no separator.",
    },
  },
  {
    native: "src/components/inline-edit-field.tsx",
    web: ["apps/web-app/src/features/shared/forms/inline-edit-field.tsx"],
    status: "matched",
  },
  {
    native: "src/components/list-skeleton.tsx",
    web: ["apps/web-app/src/components/list-skeleton.tsx"],
    status: "matched",
    allowedDifferences: {
      VerticalNavShell:
        "web shares the shell as verticalNavShellClassName; RN has no class names, so it is a styled component",
      VerticalNavTitle:
        "web shares the title as verticalNavTitleClassName; same reason",
    },
  },
  {
    native: "src/components/loading-view.tsx",
    web: [],
    note: "Native-only ActivityIndicator fallback for Suspense; non-Suspense states render in their owning screens.",
    status: "matched",
  },
  {
    native: "src/components/not-found-card.tsx",
    web: ["apps/web-app/src/components/not-found-card.tsx"],
    status: "matched",
  },
  {
    native: "src/components/option-toggle-group.tsx",
    web: ["apps/web-app/src/components/option-toggle-group.tsx"],
    status: "matched",
  },
  {
    native: "src/components/password-textarea.tsx",
    web: ["apps/web-app/src/components/password-textarea.tsx"],
    status: "matched",
  },
  {
    native: "src/components/qr-code.tsx",
    web: ["apps/web-app/src/components/copyable-qr-code.tsx"],
    status: "matched",
  },
  {
    native: "src/components/route-message.tsx",
    web: ["apps/web-app/src/components/route-message.tsx"],
    status: "matched",
  },
  {
    native: "src/components/scan-code-scanner.tsx",
    web: ["apps/web-app/src/components/scan-code-scanner.tsx"],
    status: "matched",
    allowedDifferences: {
      Button:
        "Native uses the UI-kit Button for permission grant/open-settings actions and the torch toggle; web uses browser permission UI and ScannerTorchButton.",
      ScannerTorchButton:
        "Web owns a ScannerTorchButton composition; native renders its torch toggle with the UI-kit Button.",
    },
  },
  {
    native: "src/components/screen.tsx",
    web: [],
    note: "Native only: web lays a page out with the route layout and the phone column.",
    status: "matched",
    allowedDifferences: {
      Button:
        "the chat mode's jump-to-latest button, which web draws in ChatScrollArea (settings/chat/chat-layout.tsx)",
    },
  },
  {
    native: "src/components/search-input.tsx",
    web: ["apps/web-app/src/components/search-input.tsx"],
    status: "matched",
  },
  {
    native: "src/components/success-panel.tsx",
    web: ["apps/web-app/src/components/success-panel.tsx"],
    status: "matched",
  },
  {
    native: "src/components/table-tile-shell.tsx",
    web: ["apps/web-app/src/features/shared/table-tile.tsx"],
    status: "matched",
  },
  {
    native: "src/components/vertical-nav.tsx",
    web: ["apps/web-app/src/components/vertical-nav.tsx"],
    status: "matched",
  },
  {
    native: "src/features/activity/activity-parts.tsx",
    web: [
      "apps/web-app/src/features/activity/activity-row.tsx",
      "apps/web-app/src/features/activity/activity-history-skeleton.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      VerticalNav:
        "native draws each history's day cards here, in the ActivityList both histories share; web draws them in payment-history.tsx and bill-history.tsx",
      ListSkeleton:
        "web's pagination placeholder is ActivityHistorySkeleton, a VerticalNav-shaped skeleton; native uses the kit's ListSkeleton",
      Skeleton: "inside ListSkeleton",
    },
  },
  {
    native: "src/features/activity/activity-layout.tsx",
    web: ["apps/web-app/src/features/activity/activity-layout.tsx"],
    status: "matched",
    allowedDifferences: {
      ListSkeleton:
        "the lists' Suspense fallback, which native's layout draws under the header; web's pages draw ActivityHistorySkeleton, the same VerticalNav-shaped placeholder",
      MenuBarSpacer:
        "the room under the bottom bar, which native draws over its stack (MenuBar); web's _terminal layout draws the bar beside the page",
    },
  },
  {
    native: "src/features/activity/bill-detail-page.tsx",
    web: ["apps/web-app/src/features/activity/bill-detail.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "drawn by BillStatusBadge, PaymentStatusBadge and EetSaleStatusLabel, which wrap web's Badge + class maps",
      CollisionAlert:
        "web wraps the same CollisionAlert in BillCancellationCollisionPanel; native composes it with BillCancellationCollisionActions in place",
    },
  },
  {
    native: "src/features/activity/bill-history-page.tsx",
    web: ["apps/web-app/src/features/activity/bill-history.tsx"],
    status: "matched",
    allowedDifferences: {
      VerticalNav: "drawn by the shared ActivityList in activity-parts.tsx",
    },
  },
  {
    native: "src/features/activity/detail-parts.tsx",
    web: [
      "apps/web-app/src/features/activity/bill-coverage-warning.tsx",
      "apps/web-app/src/components/detail-row.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Collapsible: "Technical, web's PaymentDetailTechnical",
      CollapsibleContent: "Technical, web's PaymentDetailTechnical",
      CollapsibleTrigger: "Technical, web's PaymentDetailTechnical",
      DetailRow:
        "the coverage warning's amount rows (web's BillCoverageAmountRow) and OptionalRow",
      FadeHeader:
        "DetailScreen, web's detail page header in activity-pages.tsx",
    },
  },
  {
    native: "src/features/activity/payment-qerko-attempts.tsx",
    web: ["apps/web-app/src/features/activity/payment-qerko-attempts.tsx"],
    status: "matched",
  },
  {
    native: "src/features/activity/payment-detail-page.tsx",
    web: ["apps/web-app/src/features/activity/payment-detail.tsx"],
    status: "matched",
    allowedDifferences: {
      Collapsible:
        "drawn by Technical in detail-parts.tsx, which both detail screens share; web keeps PaymentDetailTechnical in payment-detail.tsx",
      CollapsibleContent:
        "drawn by Technical in detail-parts.tsx, which both detail screens share; web keeps PaymentDetailTechnical in payment-detail.tsx",
      CollapsibleTrigger:
        "drawn by Technical in detail-parts.tsx, which both detail screens share; web keeps PaymentDetailTechnical in payment-detail.tsx",
    },
  },
  {
    native: "src/features/activity/payment-history-page.tsx",
    web: ["apps/web-app/src/features/activity/payment-history.tsx"],
    status: "matched",
    allowedDifferences: {
      VerticalNav: "drawn by the shared ActivityList in activity-parts.tsx",
    },
  },
  {
    native: "src/features/activity/payment-refunds.tsx",
    web: ["apps/web-app/src/features/activity/payment-refunds.tsx"],
    status: "matched",
  },
  {
    native: "src/features/activity/refund-detail-page.tsx",
    web: ["apps/web-app/src/features/activity/refund-detail-page.tsx"],
    status: "matched",
    allowedDifferences: {
      FadeHeader: "DetailScreen, web's page header",
    },
  },
  {
    native: "src/features/activity/refund-eet-reversal.tsx",
    web: ["apps/web-app/src/features/activity/refund-eet-reversal.tsx"],
    status: "matched",
  },
  {
    native: "src/features/activity/refund-page.tsx",
    web: ["apps/web-app/src/features/activity/refund-page.tsx"],
    status: "matched",
    allowedDifferences: {
      FadeHeader: "DetailScreen, web's page header",
      Alert:
        "a reversal SwitchioPay declined offers the refund to the card on the screen (refund/0008); SwitchioPay is Finito-only, so web never declines one",
      AlertTitle:
        "a reversal SwitchioPay declined offers the refund to the card on the screen (refund/0008); SwitchioPay is Finito-only, so web never declines one",
      AlertDescription:
        "a reversal SwitchioPay declined offers the refund to the card on the screen (refund/0008); SwitchioPay is Finito-only, so web never declines one",
      AlertAction:
        "a reversal SwitchioPay declined offers the refund to the card on the screen (refund/0008); SwitchioPay is Finito-only, so web never declines one",
    },
  },
  {
    native: "src/features/activity/bill-status-display.tsx",
    web: ["apps/web-app/src/features/activity/bill-status-display.ts"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "web exports the badge's class map and draws the Badge at each call site; native wraps both in BillStatusBadge",
    },
  },
  {
    native: "src/features/activity/payment-status-display.tsx",
    web: ["apps/web-app/src/features/activity/payment-status-display.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "web exports paymentStatusBadgeClassName and draws the Badge at each call site; native wraps both in PaymentStatusBadge",
    },
  },
  {
    native: "src/features/bill/assign-table-dialog.tsx",
    web: ["apps/web-app/src/features/bill/assign-table-dialog.tsx"],
    status: "matched",
  },
  {
    native: "src/features/bill/bill-page.tsx",
    web: ["apps/web-app/src/features/bill/bill-page.tsx"],
    status: "matched",
    allowedDifferences: {
      RouteMessage:
        "web answers an unparsable bill id in the route file (_terminal.bill.tsx); native's route renders this page, which does it",
    },
  },
  {
    native: "src/features/bill/bill-scan-view.tsx",
    web: ["apps/web-app/src/features/bill/bill-scan-view.tsx"],
    status: "matched",
    allowedDifferences: {
      Card: "the page passes its own item brick, a Card in the bill grid, as lastScanned, so its quantity controls are the grid's",
    },
  },
  {
    native: "src/features/bill/create-catalog-item-dialog.tsx",
    web: ["apps/web-app/src/features/bill/create-catalog-item-dialog.tsx"],
    status: "matched",
  },
  {
    native: "src/features/bill/item-quantity-controls.tsx",
    web: ["apps/web-app/src/features/bill/item-quantity-controls.tsx"],
    status: "matched",
    allowedDifferences: {
      DialogClose:
        "the kit has no DialogClose; Cancel is a plain outline Button that closes through onOpenChange",
    },
  },
  {
    native: "src/features/bill/scan-code-collision-dialog.tsx",
    web: ["apps/web-app/src/features/bill/scan-code-collision-dialog.tsx"],
    status: "matched",
  },
  {
    native: "src/features/bill/split-bill-dialog.tsx",
    web: ["apps/web-app/src/features/bill/split-bill-dialog.tsx"],
    status: "matched",
    allowedDifferences: {
      DialogClose: "the native dialog has no close part; Cancel calls onClose",
    },
  },
  {
    native: "src/features/onboarding/welcome-step.tsx",
    web: ["apps/web-app/src/features/shared/account/account-type-choice.tsx"],
    status: "matched",
    note: "fazole.fit's welcome: the logo, the name and the tagline over two buttons, new and restore (the transfer from another device is offered on the restore page), where web lists the three choices as rows.",
    allowedDifferences: {
      VerticalNav:
        "web lists the account choices as rows; native draws fazole.fit's welcome, two buttons under the logo and the tagline",
      Button:
        "fazole.fit's welcome: a primary button for a new business and a secondary one for an existing one",
    },
  },
  {
    native: "src/features/onboarding/language-select.tsx",
    web: ["apps/web-app/src/features/onboarding/language-select.tsx"],
    status: "matched",
    note: "fazole.fit's language picker: a round icon button in the welcome screen's top bar that opens a sheet of the languages, the current one marked, where web shows a select.",
    allowedDifferences: {
      Select: "web's select; native opens a dialog from an icon button",
      SelectContent: "web's select; native opens a dialog from an icon button",
      SelectGroup: "web's select; native opens a dialog from an icon button",
      SelectItem: "web's select; native lists the languages as nav rows",
      SelectTrigger: "web's select; native opens it from a kit icon button",
      SelectValue:
        "web's select; the native button shows an icon, not the value",
      Button: "fazole.fit's icon button in the top bar",
      Dialog: "the native sheet the languages open in",
      DialogContent: "the native sheet the languages open in",
      DialogHeader: "the native sheet's title",
      DialogTitle: "the native sheet's title",
      VerticalNav: "the languages as rows, the current one marked",
    },
  },
  {
    native: "src/features/onboarding/onboarding-page.tsx",
    web: ["apps/web-app/src/features/onboarding/onboarding-page.tsx"],
    status: "matched",
    note: "fazole.fit's onboarding: a welcome screen, then a headed setup page, or the chooser of onboarding/0011 and the way picked there, under a top bar. Web's welcome step is AccountTypeChoice with the same two ways in.",
    allowedDifferences: {
      FadeHeader:
        "fazole.fit's top bar: the back button, or the language picker on the welcome screen, where web draws a ghost back button in the column",
    },
  },
  {
    native: "src/features/onboarding/payments-step.tsx",
    web: [
      "apps/web-app/src/features/onboarding/onboarding-steps/payments-step.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/onboarding/selling-step.tsx",
    web: [
      "apps/web-app/src/features/onboarding/onboarding-steps/selling-step.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Field:
        "the tips switch is native's SwitchRow with its hint under it, as the settings switches",
      FieldContent:
        "the tips switch is native's SwitchRow with its hint under it, as the settings switches",
      FieldDescription:
        "the tips switch is native's SwitchRow with its hint under it, as the settings switches",
      FieldLabel:
        "the tips switch is native's SwitchRow with its hint under it, as the settings switches",
      Switch:
        "the tips switch is native's SwitchRow with its hint under it, as the settings switches",
      SwitchRow: "web's Field with a Switch, label and description",
    },
  },
  {
    native: "src/features/onboarding/selling-mode-illustrations.tsx",
    web: [
      "apps/web-app/src/features/onboarding/onboarding-steps/selling-mode-illustrations.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/onboarding/restore-sync-page.tsx",
    web: ["apps/web-app/src/features/onboarding/restore-sync-page.tsx"],
    status: "matched",
    allowedDifferences: {
      ActivityIndicator:
        "the native page uses React Native's platform spinner while sync is in progress",
    },
  },
  {
    native: "src/features/payment-tip/payment-tip-page.tsx",
    web: ["apps/web-app/src/features/payment-tip/payment-tip-page.tsx"],
    status: "matched",
    allowedDifferences: {
      RouteMessage:
        "web answers an invalid tip link in its route file (_terminal.payment.tip.tsx); native's route renders this page, which does it",
    },
  },
  {
    native: "src/features/payment-wait/payment-wait-bolt-card.tsx",
    web: ["apps/web-app/src/features/payment-wait/payment-wait-bolt-card.tsx"],
    status: "matched",
  },
  {
    native: "src/features/payment-wait/payment-wait-qerko-payment-tab.tsx",
    web: [
      "apps/web-app/src/features/payment-wait/payment-wait-qerko-payment-tab.tsx",
      "apps/web-app/src/features/payment-wait/payment-wait-qr-request.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/payment-wait/payment-wait-qerko-tab.tsx",
    web: ["apps/web-app/src/features/payment-wait/payment-wait-qerko-tab.tsx"],
    status: "matched",
  },
  {
    native: "src/features/payment-wait/payment-wait-card-tab.tsx",
    web: ["apps/web-app/src/features/payment-wait/payment-wait-card-tab.tsx"],
    status: "matched",
  },
  {
    native: "src/features/payment-wait/payment-wait-cashu-tab.tsx",
    web: [
      "apps/web-app/src/features/payment-wait/payment-wait-cashu-tab.tsx",
      "apps/web-app/src/features/payment-wait/payment-wait-qr-request.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/payment-wait/payment-wait-lightning-address-tab.tsx",
    web: [
      "apps/web-app/src/features/payment-wait/payment-wait-lightning-address-tab.tsx",
      "apps/web-app/src/features/payment-wait/payment-wait-qr-request.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/payment-wait/payment-wait-iban-tab.tsx",
    web: [
      "apps/web-app/src/features/payment-wait/payment-wait-iban-tab.tsx",
      "apps/web-app/src/features/payment-wait/payment-wait-qr-request.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      ToggleGroup:
        'Finito shows the bank QR in the account\'s default format only, with the variable symbol, account and recipient as plain rows and the cancel in a "More information" dialog; web keeps the format switch and the inline copy rows',
      ToggleGroupItem:
        'Finito shows the bank QR in the account\'s default format only, with the variable symbol, account and recipient as plain rows and the cancel in a "More information" dialog; web keeps the format switch and the inline copy rows',
      Dialog:
        'Finito shows the bank QR in the account\'s default format only, with the variable symbol, account and recipient as plain rows and the cancel in a "More information" dialog; web keeps the format switch and the inline copy rows',
      DialogContent:
        'Finito shows the bank QR in the account\'s default format only, with the variable symbol, account and recipient as plain rows and the cancel in a "More information" dialog; web keeps the format switch and the inline copy rows',
      DialogHeader:
        'Finito shows the bank QR in the account\'s default format only, with the variable symbol, account and recipient as plain rows and the cancel in a "More information" dialog; web keeps the format switch and the inline copy rows',
      DialogTitle:
        'Finito shows the bank QR in the account\'s default format only, with the variable symbol, account and recipient as plain rows and the cancel in a "More information" dialog; web keeps the format switch and the inline copy rows',
      DetailRow:
        'Finito shows the bank QR in the account\'s default format only, with the variable symbol, account and recipient as plain rows and the cancel in a "More information" dialog; web keeps the format switch and the inline copy rows',
    },
  },
  {
    native: "src/features/payment-wait/payment-wait-page.tsx",
    web: [
      "apps/web-app/src/features/payment-wait/payment-wait-page.tsx",
      "apps/web-app/src/features/payment-wait/payment-wait-cash-tab.tsx",
      "apps/web-app/src/features/payment-wait/payment-wait-qr-request.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      TabsContent:
        "web renders a TabsContent per method only as a screen-reader line; native draws the active method's content directly and states it in the prompt",
      SlidingPillTrack:
        "web animates the method pill with motion's layout animation; Finito draws the methods as Activity's tabs, whose kit pill slides to the active one, with its icon and name",
      SlidingPillSegmentContent:
        "web animates the method pill with motion's layout animation; Finito draws the methods as Activity's tabs, whose kit pill slides to the active one, with its icon and name",
    },
  },
  {
    native: "src/features/settings/about/about-page.tsx",
    web: ["apps/web-app/src/features/settings/about/about-page.tsx"],
    status: "matched",
    note: "Native retains Expo-provided version metadata and currently has no bundled animated app icon.",
    allowedDifferences: {
      Image:
        "The animated web app icon is not bundled in the native app; the app name and version remain visible.",
    },
  },
  {
    native: "src/features/settings/about/terms-page.tsx",
    web: ["apps/web-app/src/features/settings/about/terms-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/settings/access/access-settings-page.tsx",
    web: ["apps/web-app/src/features/settings/access/access-settings-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "web keeps device badges in this page; native extracts them to device-parts.tsx",
      Checkbox:
        "web keeps permission controls in this page; native extracts them to device-item.tsx",
      Dialog:
        "web keeps device editors in this page; native extracts them to device-item.tsx",
      DialogContent:
        "web keeps device editors in this page; native extracts them to device-item.tsx",
      DialogDescription:
        "web keeps device editors in this page; native extracts them to device-item.tsx",
      DialogFooter:
        "web keeps device editors in this page; native extracts them to device-item.tsx",
      DialogHeader:
        "web keeps device editors in this page; native extracts them to device-item.tsx",
      DialogTitle:
        "web keeps device editors in this page; native extracts them to device-item.tsx",
      Field:
        "web keeps PIN and permission fields in this page; native extracts them to new-pin-fields.tsx and device-item.tsx",
      FieldDescription:
        "web keeps PIN and permission fields in this page; native extracts them to new-pin-fields.tsx and device-item.tsx",
      FieldError:
        "web keeps PIN and permission fields in this page; native extracts them to new-pin-fields.tsx and device-item.tsx",
      FieldGroup:
        "web keeps PIN and permission fields in this page; native extracts them to new-pin-fields.tsx and device-item.tsx",
      FieldLabel:
        "web keeps PIN and permission fields in this page; native extracts them to new-pin-fields.tsx and device-item.tsx",
      Input:
        "web keeps PIN and rename fields in this page; native extracts them to new-pin-fields.tsx and device-parts.tsx",
      Select:
        "web keeps device preset controls in this page; native extracts them to device-parts.tsx",
      SelectContent:
        "web keeps device preset controls in this page; native extracts them to device-parts.tsx",
      SelectItem:
        "web keeps device preset controls in this page; native extracts them to device-parts.tsx",
      SelectTrigger:
        "web keeps device preset controls in this page; native extracts them to device-parts.tsx",
      SelectValue:
        "web keeps device preset controls in this page; native extracts them to device-parts.tsx",
    },
  },
  {
    native: "src/features/settings/access/account-transfer-source-page.tsx",
    web: [
      "apps/web-app/src/features/settings/account-transfer-source-page.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/access/change-pin-card.tsx",
    web: ["apps/web-app/src/features/settings/access/access-settings-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "the web file contains the full access page; native keeps this PIN card in its own file",
      CardDescription:
        "the web file contains the full access page; native keeps this PIN card in its own file",
      Checkbox:
        "the web file contains the full access page; native keeps permission controls in sibling files",
      Dialog:
        "the web file contains the full access page; native keeps device editors in sibling files",
      DialogContent:
        "the web file contains the full access page; native keeps device editors in sibling files",
      DialogDescription:
        "the web file contains the full access page; native keeps device editors in sibling files",
      DialogFooter:
        "the web file contains the full access page; native keeps device editors in sibling files",
      DialogHeader:
        "the web file contains the full access page; native keeps device editors in sibling files",
      DialogTitle:
        "the web file contains the full access page; native keeps device editors in sibling files",
      FadeHeader:
        "the web page owns its route header; this native child renders only the PIN card",
      Field:
        "the web file contains the full access page; native extracts the PIN fields to new-pin-fields.tsx",
      FieldDescription:
        "the web file contains the full access page; native extracts the PIN fields to new-pin-fields.tsx",
      FieldError:
        "the web file contains the full access page; native extracts the PIN fields to new-pin-fields.tsx",
      FieldGroup:
        "the web file contains the full access page; native extracts the PIN fields to new-pin-fields.tsx",
      FieldLabel:
        "the web file contains the full access page; native extracts the PIN fields to new-pin-fields.tsx",
      Input:
        "the web file contains the full access page; native extracts the PIN fields to new-pin-fields.tsx",
      Select:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectContent:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectItem:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectTrigger:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectValue:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
    },
  },
  {
    native: "src/features/settings/access/device-item.tsx",
    web: ["apps/web-app/src/features/settings/access/access-settings-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "the web file contains the full access page; native renders device badges in device-parts.tsx",
      Card: "the web file contains the full access page; native places this row inside the parent card in access-settings-page.tsx",
      CardContent:
        "the web file contains the full access page; native places this row inside the parent card in access-settings-page.tsx",
      CardDescription:
        "the web file contains the full access page; native places this row inside the parent card in access-settings-page.tsx",
      CardFooter:
        "the web file contains the full access page; native places this row inside the parent card in access-settings-page.tsx",
      CardHeader:
        "the web file contains the full access page; native places this row inside the parent card in access-settings-page.tsx",
      CardTitle:
        "the web file contains the full access page; native places this row inside the parent card in access-settings-page.tsx",
      FadeHeader:
        "the web page owns its route header; this native child renders one device row",
      FieldError:
        "the web file contains the full access page; the native permission editor has no input error field",
      FieldContent:
        "native's field kit groups the permission label and description; web's field markup does not need this wrapper",
      Input:
        "the web file contains the full access page; native keeps the device rename input in device-parts.tsx",
      Select:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectContent:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectItem:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectTrigger:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectValue:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
    },
  },
  {
    native: "src/features/settings/access/device-parts.tsx",
    web: ["apps/web-app/src/features/settings/access/access-settings-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Card: "the web file contains the full access page; native places these device helpers in their parent card and row",
      CardContent:
        "the web file contains the full access page; native places these device helpers in their parent card and row",
      CardDescription:
        "the web file contains the full access page; native places these device helpers in their parent card and row",
      CardFooter:
        "the web file contains the full access page; native places these device helpers in their parent card and row",
      CardHeader:
        "the web file contains the full access page; native places these device helpers in their parent card and row",
      CardTitle:
        "the web file contains the full access page; native places these device helpers in their parent card and row",
      Checkbox:
        "the web file contains the full access page; native keeps permission checkboxes in device-item.tsx",
      Dialog:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogContent:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogDescription:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogFooter:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogHeader:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogTitle:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      FadeHeader:
        "the web page owns its route header; this native file supplies device subcomponents",
      FieldDescription:
        "the web file contains the full access page; native keeps permission descriptions in device-item.tsx",
      FieldError:
        "the web file contains the full access page; native keeps permission errors in device-item.tsx",
      FieldGroup:
        "the web file contains the full access page; native keeps permission groups in device-item.tsx",
    },
  },
  {
    native: "src/features/settings/access/new-pin-fields.tsx",
    web: ["apps/web-app/src/features/settings/access/access-settings-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "the web file contains the full access page; native keeps device badges in device-parts.tsx",
      Button:
        "the web file contains the full access page; native keeps PIN actions in parent cards",
      Card: "the web file contains the full access page; native keeps PIN fields inside parent cards",
      CardContent:
        "the web file contains the full access page; native keeps PIN fields inside parent cards",
      CardDescription:
        "the web file contains the full access page; native keeps PIN fields inside parent cards",
      CardFooter:
        "the web file contains the full access page; native keeps PIN fields inside parent cards",
      CardHeader:
        "the web file contains the full access page; native keeps PIN fields inside parent cards",
      CardTitle:
        "the web file contains the full access page; native keeps PIN fields inside parent cards",
      Checkbox:
        "the web file contains the full access page; native keeps permission checkboxes in device-item.tsx",
      Dialog:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogContent:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogDescription:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogFooter:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogHeader:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      DialogTitle:
        "the web file contains the full access page; native keeps device dialogs in device-item.tsx",
      FadeHeader:
        "the web page owns its route header; this native child renders only PIN fields",
      Select:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectContent:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectItem:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectTrigger:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectValue:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
    },
  },
  {
    native: "src/features/settings/access/turn-on-wizard.tsx",
    web: ["apps/web-app/src/features/settings/access/access-settings-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "the web file contains the full access page; native renders device badges in device-parts.tsx",
      Checkbox:
        "the web file contains the full access page; native renders permission controls in device-item.tsx",
      DialogFooter:
        "the web file contains the full access page; native keeps dialog actions in device-item.tsx",
      FadeHeader:
        "the web page owns its route header; this native child renders only the enable wizard",
      Field:
        "the web file contains the full access page; native extracts PIN fields to new-pin-fields.tsx",
      FieldDescription:
        "the web file contains the full access page; native extracts PIN fields to new-pin-fields.tsx",
      FieldError:
        "the web file contains the full access page; native extracts PIN fields to new-pin-fields.tsx",
      FieldGroup:
        "the web file contains the full access page; native extracts PIN fields to new-pin-fields.tsx",
      FieldLabel:
        "the web file contains the full access page; native extracts PIN fields to new-pin-fields.tsx",
      Input:
        "the web file contains the full access page; native extracts PIN fields to new-pin-fields.tsx",
      Select:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectContent:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectItem:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectTrigger:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
      SelectValue:
        "the web file contains the full access page; native keeps device presets in device-parts.tsx",
    },
  },
  {
    native: "src/features/settings/accounts/open-account-page.tsx",
    web: ["apps/web-app/src/features/settings/accounts/open-account-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/settings/accounts/accounts-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/accounts/accounts-settings-page.tsx",
    ],
    status: "matched",
    note: "Native account rows use the last persisted nostrPicture; web prefers the active account's current profile query and falls back to the persisted picture. Both open an existing account on /settings/accounts/open (onboarding/0011); native's row also names the web app's Android shell (me.payky) when it takes the request (account/0008).",
  },
  {
    native: "src/features/settings/assistant/assistant-chat-page.tsx",
    web: [
      "apps/web-app/src/features/settings/assistant/assistant-chat-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      FadeHeader:
        "The web ChatLayout renders the same page header internally; native places FadeHeader directly in Screen.",
    },
    note: "Web ChatScrollArea's follow-while-reading and jump-to-latest behavior is Screen's followKey mode on native.",
  },
  {
    native: "src/features/settings/debug-console/cashu-shard-debug-card.tsx",
    web: [
      "apps/web-app/src/features/settings/debug-console/cashu-shard-debug-card.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/debug-console/debug-console-page.tsx",
    web: [
      "apps/web-app/src/features/settings/debug-console/debug-console-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Badge:
        "Native uses the existing Badge for console method labels; web styles those labels as inline spans.",
    },
  },
  {
    native: "src/features/settings/demo-data/demo-data-page.tsx",
    web: ["apps/web-app/src/features/settings/demo-data/demo-data-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/settings/donations/donation-history.tsx",
    web: ["apps/web-app/src/features/settings/donations/donation-history.tsx"],
    status: "matched",
    note: "Native keeps its explicit load-more control; web loads pages as the history scrolls.",
  },
  {
    native:
      "src/features/settings/donations/donations-invoice-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/donations/donations-invoice-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      CopyableQrCode:
        "Native retains the donation-specific copy button and toast messages below the QR, while web copies by tapping the QR itself.",
    },
  },
  {
    native: "src/features/settings/donations/donations-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/donations/donations-settings-page.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/eet/eet-certificate-import.tsx",
    web: ["apps/web-app/src/features/settings/eet/eet-certificate-card.tsx"],
    status: "matched",
    allowedDifferences: {
      Alert:
        "The native certificate and expiry warning is rendered by the sibling StoredCertificate component inside the parent certificate card.",
      AlertDescription:
        "The native certificate and expiry warning is rendered by the sibling StoredCertificate component inside the parent certificate card.",
      AlertTitle:
        "The native certificate and expiry warning is rendered by the sibling StoredCertificate component inside the parent certificate card.",
      Badge:
        "The native test-certificate badge is rendered by the sibling StoredCertificate component inside the parent certificate card.",
      Card: "The native certificate card wraps this import form in the parent EET settings page.",
      CardContent:
        "The native certificate card wraps this import form in the parent EET settings page.",
      CardDescription:
        "The native certificate card header is rendered by the parent EET settings page.",
      CardHeader:
        "The native certificate card header is rendered by the parent EET settings page.",
      CardTitle:
        "The native certificate card header is rendered by the parent EET settings page.",
    },
  },
  {
    native: "src/features/settings/eet/eet-official-test-certificates.tsx",
    web: ["apps/web-app/src/features/settings/eet/eet-certificate-card.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "Certificate file/password fields and the test-certificate badge are siblings within the native parent card, not part of this official-certificate list.",
      Card: "The native certificate card wraps this official-certificate list in the parent EET settings page.",
      CardContent:
        "The native certificate card wraps this official-certificate list in the parent EET settings page.",
      CardDescription:
        "The native certificate card header is rendered by the parent EET settings page.",
      CardHeader:
        "The native certificate card header is rendered by the parent EET settings page.",
      CardTitle:
        "The native certificate card header is rendered by the parent EET settings page.",
      Field:
        "The native certificate file/password fields are in the sibling EetCertificateImport component.",
      FieldDescription:
        "The native certificate file/password fields are in the sibling EetCertificateImport component.",
      FieldError:
        "The native certificate file/password fields are in the sibling EetCertificateImport component.",
      FieldGroup:
        "The native certificate file/password fields are in the sibling EetCertificateImport component.",
      FieldLabel:
        "The native certificate file/password fields are in the sibling EetCertificateImport component.",
      Input:
        "The native certificate file/password fields are in the sibling EetCertificateImport component.",
    },
  },
  {
    native: "src/features/settings/eet/eet-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/eet/eet-settings-page.tsx",
      "apps/web-app/src/features/settings/eet/eet-certificate-card.tsx",
      "apps/web-app/src/features/shared/forms/inline-edit-switch.tsx",
      "apps/web-app/src/features/shared/forms/inline-edit-toggle-group.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Button:
        "The native certificate import action is in the separate EetCertificateImport child; the web source keeps it inline with the settings page.",
      FieldLabel:
        "Web's environment label is visually hidden; the native environment choices already announce each option and do not repeat the card title.",
      FieldError:
        "The native InlineEditField child renders its validation error internally; the web source inlines that part of the field.",
      Input:
        "The native InlineEditField child renders its input internally; the web source inlines that part of the field.",
    },
  },
  {
    native: "src/features/settings/eet/eet-test-section.tsx",
    web: ["apps/web-app/src/features/settings/eet/eet-test-card.tsx"],
    status: "matched",
  },
  {
    native: "src/features/settings/eet/eet-unconfirmed-sales.tsx",
    web: [
      "apps/web-app/src/features/settings/eet/eet-unconfirmed-sales-card.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/evolu-export/evolu-export-page.tsx",
    web: [
      "apps/web-app/src/features/settings/evolu-export/evolu-export-page.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/fio-plugin/fio-plugin-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/fio-plugin/fio-plugin-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Alert: "web-only browser runtime warning, omitted in the native app",
      AlertDescription:
        "web-only browser runtime warning, omitted in the native app",
      AlertTitle: "web-only browser runtime warning, omitted in the native app",
      Badge: "rendered by the sibling fio-token-list.tsx",
      Button:
        "rendered by the sibling fio-token-form.tsx and fio-token-list.tsx",
      FieldError: "rendered by the sibling fio-token-form.tsx",
      PasswordTextarea: "rendered by the sibling fio-token-form.tsx",
      Switch:
        "known control-type gap: native keeps its existing switch (role switch) for the active toggle where web saves the same flag through InlineEditCheckbox, which wraps ui/checkbox; ui/checkbox exists natively, the swap is left for device acceptance",
    },
  },
  {
    native:
      "src/features/settings/moneta-plugin/moneta-plugin-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/moneta-plugin/moneta-plugin-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      CardDescription:
        "web's connect card gets its description through SettingsFormCard, a web wrapper the kit has no counterpart of; native draws the same card from Card parts, as fio-token-form.tsx does",
      Switch:
        "known control-type gap, as on the Fio page: native keeps its switch for the active toggle where web saves the same flag through InlineEditCheckbox",
    },
  },
  {
    native: "src/features/settings/fio-plugin/fio-token-form.tsx",
    web: [
      "apps/web-app/src/features/settings/fio-plugin/fio-plugin-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Alert: "web-only browser runtime warning, omitted in the native app",
      AlertDescription:
        "web-only browser runtime warning, omitted in the native app",
      AlertTitle: "web-only browser runtime warning, omitted in the native app",
      Badge: "rendered by the sibling fio-token-list.tsx",
      FadeHeader: "rendered by the parent fio-plugin-settings-page.tsx",
    },
  },
  {
    native: "src/features/settings/fio-plugin/fio-token-list.tsx",
    web: [
      "apps/web-app/src/features/settings/fio-plugin/fio-plugin-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Alert: "web-only browser runtime warning, omitted in the native app",
      AlertDescription:
        "web-only browser runtime warning, omitted in the native app",
      AlertTitle: "web-only browser runtime warning, omitted in the native app",
      FadeHeader: "rendered by the parent fio-plugin-settings-page.tsx",
      Field: "rendered by the sibling fio-token-form.tsx",
      FieldDescription: "rendered by the sibling fio-token-form.tsx",
      FieldError: "rendered by the sibling fio-token-form.tsx",
      FieldGroup: "rendered by the sibling fio-token-form.tsx",
      FieldLabel: "rendered by the sibling fio-token-form.tsx",
      PasswordTextarea: "rendered by the sibling fio-token-form.tsx",
    },
  },
  {
    native: "src/features/catalog/items/edit-item-page.tsx",
    web: ["apps/web-app/src/features/catalog/items/item-form-page.tsx"],
    status: "matched",
    allowedDifferences: {
      FieldError:
        "native auto-saving InlineEditField components own the validation messages; the web source also includes create-form FieldError parts",
      FieldContent:
        "the web source also includes the create form, whose Discount switch's label sits in FieldContent; an existing item's sign is not edited (catalog/0002)",
      Input:
        "native auto-saving InlineEditField components own their inputs; the web source also includes create-form Input parts",
      ScanCodeScanner:
        "native renders the camera inline after the scan-code field instead of inside a modal",
      ScanCodeScannerDialog:
        "web wraps the scanner in a dialog; native renders it inline after the scan-code field",
      Switch:
        "the web source also includes the create form's Discount switch; an existing item's sign is not edited (catalog/0002)",
    },
  },
  {
    native: "src/features/catalog/items/items-page.tsx",
    web: ["apps/web-app/src/features/catalog/items/items-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/catalog/items/new-item-page.tsx",
    web: ["apps/web-app/src/features/catalog/items/item-form-page.tsx"],
    status: "matched",
    allowedDifferences: {
      CardFooter:
        "the web SettingsFormCard feature helper composes CardFooter; native composes the same footer directly",
      ScanCodeScanner:
        "native renders the camera inline after the scan-code field instead of inside a modal",
      ScanCodeScannerDialog:
        "web wraps the scanner in a dialog; native renders it inline after the scan-code field",
    },
  },
  {
    native: "src/features/catalog/items/scan-code-button.tsx",
    web: ["apps/web-app/src/features/catalog/items/item-form-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Card: "The mapped web source is the full item form; this native row covers only its scan button.",
      CardContent:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      CardDescription:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      CardHeader:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      CardTitle:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      FadeHeader:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      Field:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      FieldDescription:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      FieldError:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      FieldGroup:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      FieldLabel:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      Input:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      ScanCodeScannerDialog:
        "Scanner layout belongs to the item-form rows, which document the web dialog and native inline scanner difference.",
      Select:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      SelectContent:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      SelectGroup:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      SelectItem:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      SelectTrigger:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      SelectValue:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      FieldContent:
        "The mapped web source is the full item form; this native row covers only its scan button.",
      Switch:
        "The mapped web source is the full item form; this native row covers only its scan button.",
    },
  },
  {
    native: "src/features/settings/language/language-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/language/language-settings-page.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/card-closure/card-closure-detail-page.tsx",
    web: [],
    note: "Finito only: one recorded closure of the SwitchioPay batch, which web does not close (payment/0008, access/0011).",
    status: "matched",
    allowedDifferences: {
      FadeHeader: "the screen's title, Closure detail",
      NotFoundCard: "an id that matches no closure",
      Card: "the closure's totals",
      CardHeader: "the card's title and when the closure was recorded",
      CardTitle: "the card's title",
      CardDescription: "when the closure was recorded",
      CardContent: "the card's body",
      DetailRow:
        "the counts and amounts of payments, refunds and adjustments, then the terminal, batch, shift and terminal time",
      Separator: "the totals apart from where and when the batch was closed",
    },
  },
  {
    native: "src/features/settings/card-closure/card-closure-page.tsx",
    web: [],
    note: "Finito only: closing the SwitchioPay batch needs the Expo module's closure intent, which web's Capacitor bridge does not have (payment/0008, access/0011).",
    status: "matched",
    allowedDifferences: {
      FadeHeader: "the screen's title, Terminal closures",
      Card: "one card each for this terminal, the result, the business's terminals and the history",
      CardHeader: "each card's title and description",
      CardTitle: "each card's title",
      CardDescription:
        "what the closure does, when the shown result was recorded, and that another phone's terminal cannot be closed from here",
      CardContent: "each card's body",
      DetailRow:
        "the last closure's time and the result's totals, batch and shift",
      Alert:
        "SwitchioPay missing on this device, and an unknown outcome that stays on screen until staff checks SwitchioPay",
      AlertTitle: "the unknown outcome's message",
      AlertDescription: "the missing-SwitchioPay warning",
      Button: "the one action, Close the batch",
      Badge: "whether each terminal was closed today",
      VerticalNavTitle:
        "the history card's heading, drawn above its rows in the one virtualized list",
      VerticalNavRow:
        "the last closure and each history row, which open the closure's detail",
    },
  },
  {
    native:
      "src/features/settings/payment-accounts/card-switchio-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/card-switchio-settings-page.tsx",
    ],
    status: "matched",
  },
  {
    native:
      "src/features/settings/payment-accounts/lightning-address-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/lightning-address-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Button:
        "the web SettingsFormCard feature helper composes the card and its submit Button; native composes them directly",
      Card: "the web SettingsFormCard feature helper composes the card and its submit Button; native composes them directly",
      CardContent:
        "the web SettingsFormCard feature helper composes the card and its submit Button; native composes them directly",
      CardDescription:
        "the web SettingsFormCard feature helper composes the card and its submit Button; native composes them directly",
      CardFooter:
        "the web SettingsFormCard feature helper composes the card and its submit Button; native composes them directly",
      CardHeader:
        "the web SettingsFormCard feature helper composes the card and its submit Button; native composes them directly",
      CardTitle:
        "the web SettingsFormCard feature helper composes the card and its submit Button; native composes them directly",
    },
  },
  {
    native: "src/features/settings/payment-accounts/qerko-pairing-wizard.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/qerko-pairing-wizard.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      SelectGroup:
        "Web groups a select's items for its popup; native's SelectContent lists its items in a sheet and has no group part.",
    },
  },
  {
    native: "src/features/settings/payment-accounts/qerko-location-chooser.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/qerko-location-chooser.tsx",
    ],
    status: "matched",
  },
  {
    native:
      "src/features/settings/payment-accounts/qerko-payment-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/qerko-payment-settings-page.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/payment-accounts/qerko-terminal-chooser.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/qerko-terminal-chooser.tsx",
    ],
    status: "matched",
  },
  {
    native:
      "src/features/settings/payment-accounts/qerko-terminal-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/qerko-terminal-settings-page.tsx",
    ],
    status: "matched",
  },
  {
    native:
      "src/features/settings/payment-accounts/cashu-account-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/cashu/cashu-account-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Alert:
        "Native adds an inline retry alert on wallet-query errors; the web keeps its existing snapshot/default rendering.",
      AlertAction:
        "Native adds an inline retry alert on wallet-query errors; the web keeps its existing snapshot/default rendering.",
      AlertDescription:
        "Native adds an inline retry alert on wallet-query errors; the web keeps its existing snapshot/default rendering.",
      Button:
        "Native's retry button on wallet-query errors and Finito's Withdraw funds button under the balance (Fazole's wallet screen); web offers withdrawing as a list row.",
      Card: "Finito shows the balance alone, as Fazole does; web wraps the wallet in a card.",
      VerticalNav:
        "the wallet's rows are drawn by the shared WalletBody (features/shared/wallet-body.tsx)",
      CardContent:
        "Finito shows the balance alone, as Fazole does; web wraps the wallet in a card.",
      CardDescription:
        "Finito shows the balance alone, as Fazole does; web wraps the wallet in a card.",
      CardHeader:
        "Finito shows the balance alone, as Fazole does; web wraps the wallet in a card.",
      CardTitle:
        "Finito shows the balance alone, as Fazole does; web wraps the wallet in a card.",
    },
  },
  {
    native: "src/features/settings/payment-accounts/cashu-mint-detail-page.tsx",
    web: [
      "apps/web-app/src/features/settings/cashu/cashu-mint-detail-page.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/payment-accounts/cashu-mint-new-page.tsx",
    web: ["apps/web-app/src/features/settings/cashu/cashu-mint-new-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/settings/payment-accounts/cashu-payment-qr-page.tsx",
    web: [],
    status: "matched",
    note: "What the Cashu wallet's payment QR carries (settings/0003), a choice web does not offer: one option list, as the theme screen's.",
    allowedDifferences: {
      FadeHeader: "the screen's title, Payment QR",
      OptionToggleGroup:
        "the three choices as one option list, as the theme screen's",
    },
  },
  {
    native: "src/features/settings/payment-accounts/cashu-mints-page.tsx",
    web: ["apps/web-app/src/features/settings/cashu/cashu-mints-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Alert:
        "Native adds an inline retry alert on wallet-query errors; the web keeps its existing snapshot/default rendering.",
      AlertAction:
        "Native adds an inline retry alert on wallet-query errors; the web keeps its existing snapshot/default rendering.",
      AlertDescription:
        "Native adds an inline retry alert on wallet-query errors; the web keeps its existing snapshot/default rendering.",
      Button:
        "Native adds an inline retry action on wallet-query errors; the web keeps its existing snapshot/default rendering.",
    },
  },
  {
    native:
      "src/features/settings/payment-accounts/fiat-bank-account-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/fiat-bank-account-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Select:
        "native bottom-sheet selector replaces web's feature-level InlineEditSelect",
      SelectContent:
        "native bottom-sheet selector replaces web's feature-level InlineEditSelect",
      SelectItem:
        "native bottom-sheet selector replaces web's feature-level InlineEditSelect",
      SelectTrigger:
        "native bottom-sheet selector replaces web's feature-level InlineEditSelect",
      SelectValue:
        "native bottom-sheet selector replaces web's feature-level InlineEditSelect",
      ToggleGroup:
        "native toggle group replaces web's shared BankAccountFormatToggle helper",
      ToggleGroupItem:
        "native toggle group replaces web's shared BankAccountFormatToggle helper",
    },
  },
  {
    native:
      "src/features/settings/payment-accounts/payment-accounts-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/payment-accounts-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Button:
        "web's grip is a ghost icon Button; native's DragHandle is an Animated.View with a pan responder and TalkBack move actions",
      Switch:
        "native renders each method's enable toggle with ui/switch directly; web routes the same immediate save through InlineEditSwitch, which wraps ui/switch",
      VerticalNavShell:
        "web styles its list with verticalNavShellClassName; native renders the exported shell component itself",
    },
  },
  {
    native:
      "src/features/settings/payment-accounts/spark-account-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/spark-account-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Switch:
        "known control-type gap: native keeps its existing switch (role switch) for privacy mode where web saves the same choice through InlineEditCheckbox, which wraps ui/checkbox; ui/checkbox exists natively, the swap is left for device acceptance",
      VerticalNav:
        "the wallet's rows are drawn by the shared WalletBody (features/shared/wallet-body.tsx)",
    },
  },
  {
    native:
      "src/features/settings/payment-accounts/spark-transactions-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-accounts/spark-transactions-page.tsx",
    ],
    status: "matched",
  },
  {
    native:
      "src/features/settings/payment-number-series/payment-number-series-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/payment-number-series/payment-number-series-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      DateInput:
        "native edits the existing yyyy-MM-dd value with a keyboard field; web uses the browser date input",
      OptionToggleGroup:
        "native renders the option groups directly and saves each choice immediately; web wraps the same immediate choices in InlineEditToggleGroup",
    },
  },
  {
    native: "src/features/settings/privacy/ai-assistant-card.tsx",
    web: ["apps/web-app/src/features/settings/privacy/ai-assistant-card.tsx"],
    status: "matched",
  },
  {
    native: "src/features/settings/privacy/consent-card.tsx",
    web: [
      "apps/web-app/src/features/settings/privacy/error-reporting-card.tsx",
      "apps/web-app/src/features/settings/privacy/product-lookup-card.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/privacy/privacy-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/privacy/privacy-settings-page.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/profile/profile-card.tsx",
    web: ["apps/web-app/src/features/settings/profile/profile-card.tsx"],
    status: "matched",
    allowedDifferences: {
      VerticalNavShell:
        "web styles its Link with verticalNavShellClassName; native renders the exported shell component itself",
    },
  },
  {
    native: "src/features/settings/profile/profile-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/profile/profile-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Field:
        "Native uses InlineEditField, which renders the same ui/field primitives internally; the name edit stays editable on-device without a separate web-style field wrapper.",
      FieldError:
        "The native InlineEditField owns validation and renders its field error internally.",
      FieldGroup:
        "Native groups these controls with the CardContent YStack while keeping the app's shared InlineEditField intact.",
      FieldLabel:
        "The native InlineEditField and picture label render labels inside the controls' existing native components.",
      Select:
        "the business's country and currency sit on the profile screen, unlabelled, where web has a legal-entity screen",
      SelectTrigger:
        "the business's country and currency sit on the profile screen, unlabelled, where web has a legal-entity screen",
      SelectValue:
        "the business's country and currency sit on the profile screen, unlabelled, where web has a legal-entity screen",
      SelectContent:
        "the business's country and currency sit on the profile screen, unlabelled, where web has a legal-entity screen",
      SelectItem:
        "the business's country and currency sit on the profile screen, unlabelled, where web has a legal-entity screen",
      Switch:
        "the VAT-payer row is a switch on the profile screen, where web's legal-entity screen has a checkbox",
    },
  },
  {
    native: "src/features/settings/security/recovery-backup-card.tsx",
    web: [
      "apps/web-app/src/features/settings/security/recovery-backup-card.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/security/recovery-backup-page.tsx",
    web: [
      "apps/web-app/src/features/settings/security/recovery-backup-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      CardContent:
        "Web lays the steps out with a flex column inside CardContent; native renders each step's own YStack.",
    },
  },
  {
    native: "src/features/settings/security/recovery-verify-step.tsx",
    web: [
      "apps/web-app/src/features/settings/security/recovery-verify-step.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/settings/security/recovery-words-grid.tsx",
    web: [
      "apps/web-app/src/features/settings/security/recovery-words-grid.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Input:
        "Web shows the words in read-only inputs; native draws them as unselectable Text, so the phrase cannot be selected or copied (account/0007).",
    },
  },
  {
    native: "src/features/settings/security/security-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/security/security-settings-page.tsx",
      "apps/web-app/src/features/settings/security/evolu-transport-card.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/shared/evolu-transports/transport-add-form.tsx",
    web: [
      "apps/web-app/src/features/shared/evolu-transports/transport-add-form.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/shared/evolu-transports/transport-toggle-list.tsx",
    web: [
      "apps/web-app/src/features/shared/evolu-transports/transport-toggle-list.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/shared/evolu-transports/transport-sync-status.tsx",
    web: [
      "apps/web-app/src/features/shared/evolu-transports/transport-sync-status.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/catalog/catalog-form-empty-state.tsx",
    web: ["apps/web-app/src/features/catalog/catalog-form-empty-state.tsx"],
    status: "matched",
  },
  {
    native: "src/features/catalog/catalog-list-parts.tsx",
    web: [
      "apps/web-app/src/features/catalog/catalog-list-page.tsx",
      "apps/web-app/src/features/catalog/catalog-entity-list.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      ListSkeleton:
        "Native keeps the existing ActivityIndicator footer while fetching more rows; web adds a ListSkeleton.",
      VerticalNavRow:
        "Native uses a row helper to preserve FlatList virtualization inside the VerticalNav shell.",
    },
  },
  {
    native: "src/features/settings/settings-page.tsx",
    web: ["apps/web-app/src/features/settings/settings-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Building2:
        "lucide-react-native 1.57.0 has no building-2 module; native uses its available building icon.",
      MenuBarSpacer:
        "the room under the bottom bar, which native draws over its stack (MenuBar); web's _terminal layout draws the bar beside the page",
      Skeleton:
        "native holds each row's value behind its own Suspense so the list shows before the database answers; web reads them with the page",
    },
  },
  {
    native: "src/features/settings/support/dm-inbox-warning.tsx",
    web: ["apps/web-app/src/features/settings/support/support-chat-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Badge:
        "The native support page draws its timeline day Badge in the parent support-chat-page component, not in this warning child.",
      Skeleton:
        "The native support page draws its loading Skeletons in the parent support-chat-page component, not in this warning child.",
    },
  },
  {
    native: "src/features/settings/support/support-chat-page.tsx",
    web: ["apps/web-app/src/features/settings/support/support-chat-page.tsx"],
    status: "matched",
    allowedDifferences: {
      FadeHeader:
        "The web ChatLayout renders the same page header internally; native places FadeHeader directly in Screen.",
    },
    note: "Web ChatScrollArea's follow-while-reading and jump-to-latest behavior is Screen's followKey mode on native.",
  },
  {
    native: "src/features/catalog/tables/edit-table-page.tsx",
    web: ["apps/web-app/src/features/catalog/tables/table-form-page.tsx"],
    status: "matched",
    allowedDifferences: {
      FieldError:
        "native auto-saving InlineEditField components own validation messages; the web source also includes create-form FieldError parts",
    },
  },
  {
    native: "src/features/catalog/tables/new-table-page.tsx",
    web: ["apps/web-app/src/features/catalog/tables/table-form-page.tsx"],
    status: "matched",
    allowedDifferences: {
      CardFooter:
        "the web SettingsFormCard feature helper composes CardFooter; native composes the same footer directly",
      FieldDescription:
        "the web source's code-field description exists only after a table has been created",
    },
  },
  {
    native: "src/features/catalog/tables/tables-page.tsx",
    web: ["apps/web-app/src/features/catalog/tables/tables-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/settings/tax-rates/tax-rates-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/tax-rates/tax-rates-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Star: "the default-rate button uses the native secondary variant but the lucide-react-native star remains unfilled; the web fills its star icon",
      CardDescription:
        "native uses CardDescription for descriptive copy that the web renders as a paragraph",
      CardTitle:
        "native uses CardTitle for the add-rate heading that the web renders as a paragraph",
    },
  },
  {
    native: "src/features/settings/theme/theme-settings-page.tsx",
    web: ["apps/web-app/src/features/settings/theme/theme-settings-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/settings/tips/tips-settings-page.tsx",
    web: [
      "apps/web-app/src/features/shared/forms/form-card.tsx",
      "apps/web-app/src/features/settings/tips/tips-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      SavedMessage:
        "every change saves itself (fazole-ui-minimal-copy); there is no Save and nothing to confirm",
      Card: "no card on a mobile detail screen; the controls sit on the page",
      CardHeader:
        "no card on a mobile detail screen; the controls sit on the page",
      CardTitle:
        "no card on a mobile detail screen; the controls sit on the page",
      CardDescription: "no second-line explanations (fazole-ui-minimal-copy)",
      CardContent:
        "no card on a mobile detail screen; the controls sit on the page",
      CardFooter: "no Save button: every change saves itself",
      FieldGroup: "the page's own spacing stands in for the group",
      Checkbox: "the enabled row is a switch, as the other settings rows",
      Switch: "the enabled row is a switch, as the other settings rows",
      FieldContent: "the enabled row is one line, label and switch",
      FieldDescription: "no second-line explanations (fazole-ui-minimal-copy)",
    },
  },
  {
    native: "src/features/shared/open-account-choice.tsx",
    web: ["apps/web-app/src/features/shared/account/open-account-choice.tsx"],
    status: "matched",
    note: "The chooser of onboarding/0011. Native adds the row for the web app's Android shell (me.payky) on the same phone when it takes the request (account/0008); web has no app-to-app source.",
  },
  {
    native: "src/features/shared/open-account-flow.tsx",
    web: ["apps/web-app/src/features/shared/account/open-account-flow.tsx"],
    status: "matched",
    note: "Native also renders the request to the web app's Android shell (account/0008), which web never offers.",
  },
  {
    native: "src/features/shared/account-from-payky.tsx",
    web: [],
    status: "matched",
    note: "Native only (account/0008): web has no app-to-app source. The other side of the request is apps/web-app/src/features/settings/account-share-page.tsx, a different screen. The code is drawn like account-transfer-target's.",
    allowedDifferences: {
      Alert: "native only: why the request ended without an account",
      AlertDescription: "native only: why the request ended without an account",
      AlertTitle: "native only: why the request ended without an account",
      Button: "native only: open the other app, and try again",
    },
  },
  {
    native: "src/features/shared/account-transfer-target.tsx",
    web: [
      "apps/web-app/src/features/shared/account/account-transfer-target.tsx",
    ],
    status: "matched",
    note: "Native keeps the validated QR scan filter. The code text uses the native Inter typeface because the configured native fonts have no mono family.",
  },
  {
    native: "src/features/shared/bill-cancellation-collision-actions.tsx",
    web: [
      "apps/web-app/src/features/activity/bill-cancellation-collision-panel.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      CollisionAlert:
        "native activity callers wrap the shared action block; the whole-screen bill cancellation page supplies its own warning and summary",
    },
  },
  {
    native: "src/features/shared/category-filter-bar.tsx",
    web: ["apps/web-app/src/features/shared/category-filter-bar.tsx"],
    status: "matched",
    note: "The native rail uses horizontal swipe scrolling without the web edge fade or desktop scrollbar; filters, order, and touch sizing match.",
  },
  {
    native: "src/features/shared/chat-composer.tsx",
    web: ["apps/web-app/src/features/settings/chat/chat-layout.tsx"],
    status: "matched",
    note: "This native entry mirrors ChatComposer only; the mapped web module also exports FadeHeader and ChatScrollArea. Native follow/jump-to-latest is Screen's followKey mode.",
    allowedDifferences: {
      FadeHeader:
        "sibling layout export in the web chat module; not part of the ChatComposer block",
    },
  },
  {
    native: "src/features/shared/discount-switch-field.tsx",
    web: ["apps/web-app/src/features/shared/forms/discount-switch-field.tsx"],
    status: "matched",
  },
  {
    native: "src/features/shared/eet-sale-status.tsx",
    web: ["apps/web-app/src/features/shared/eet-sale-status.tsx"],
    status: "matched",
  },
  {
    native: "src/features/shared/eet-sandbox-banner.tsx",
    web: ["apps/web-app/src/features/shared/eet-sandbox-banner.tsx"],
    status: "matched",
    note: "Web overlays the banner and pads the viewport by its height; native lays it out above the navigator from the root layout.",
  },
  {
    native: "src/features/shared/refund-badge.tsx",
    web: ["apps/web-app/src/features/shared/refund-badge.tsx"],
    status: "matched",
  },
  {
    native: "src/features/shared/restore-account-step.tsx",
    web: [
      "apps/web-app/src/features/shared/account/restore-account-form.tsx",
      "apps/web-app/src/features/shared/account/restore-words-grid.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Badge:
        "native badges are never pressable, so the word suggestions are small outline Buttons",
      Label:
        "web wraps the switch in a Label; native has no label-for, so the switch carries an aria-label and a Text sits beside it",
    },
    note: "Native reads the clipboard through expo-clipboard and draws the word-grid inside the step. The submit button matches the onboarding full-width/min-height-44 wrapper and the Settings default-size/end-aligned layout; native hitSlop retains the touch target.",
  },
  {
    native: "src/features/shared/tax-recap.tsx",
    web: ["apps/web-app/src/features/shared/tax-recap.tsx"],
    status: "matched",
    allowedDifferences: {
      Separator:
        "native uses the kit Separator between recap rows where web uses divide-y CSS",
    },
  },
  {
    native: "src/features/stats/device-breakdown.tsx",
    web: ["apps/web-app/src/features/stats/device-breakdown.tsx"],
    status: "matched",
  },
  {
    native: "src/features/stats/kpi-tiles.tsx",
    web: ["apps/web-app/src/features/stats/kpi-tiles.tsx"],
    status: "matched",
  },
  {
    native: "src/features/stats/method-breakdown.tsx",
    web: ["apps/web-app/src/features/stats/method-breakdown.tsx"],
    status: "matched",
    allowedDifferences: {
      ChartContainer:
        "native draws the donut with react-native-svg and selects a segment on tap",
      ChartTooltip:
        "native shows selected segment details on tap instead of a hover tooltip",
    },
  },
  {
    native: "src/features/stats/open-bills-summary.tsx",
    web: ["apps/web-app/src/features/stats/open-bills-summary.tsx"],
    status: "matched",
  },
  {
    native: "src/features/stats/period-selector.tsx",
    web: ["apps/web-app/src/features/stats/period-selector.tsx"],
    status: "matched",
    allowedDifferences: {
      Input:
        "native uses an editable yyyy-mm-dd text field instead of the browser date picker",
    },
  },
  {
    native: "src/features/stats/revenue-chart.tsx",
    web: ["apps/web-app/src/features/stats/revenue-chart.tsx"],
    status: "matched",
    allowedDifferences: {
      ChartContainer:
        "native draws bars and axes with react-native-svg to support touch layout",
      ChartTooltip:
        "native shows selected bar details on tap instead of a hover tooltip",
    },
  },
  {
    native: "src/features/stats/sales-heatmap.tsx",
    web: ["apps/web-app/src/features/stats/sales-heatmap.tsx"],
    status: "matched",
    allowedDifferences: {
      HeatmapCellSize:
        "native cells are 22px tall as tap targets; web cells are 16px",
    },
  },
  {
    native: "src/features/stats/signals.tsx",
    web: ["apps/web-app/src/features/stats/signals.tsx"],
    status: "matched",
  },
  {
    native: "src/features/stats/stats-page.tsx",
    web: ["apps/web-app/src/features/stats/stats-page.tsx"],
    status: "matched",
    allowedDifferences: {
      StickyPeriodToolbar:
        "native Screen scrolls the period controls with content and has no sticky-header facility",
      OpenBillsLoading:
        "native keeps open bills in the existing PeriodStats loading branch; web loads it under a separate Suspense fallback",
      LiveIndicator: "native keeps a static success dot; web animates a ping",
    },
  },
  {
    native: "src/features/stats/stats-section.tsx",
    web: ["apps/web-app/src/features/stats/stats-section.tsx"],
    status: "matched",
  },
  {
    native: "src/features/stats/top-sales.tsx",
    web: [
      "apps/web-app/src/features/stats/top-sales.tsx",
      "apps/web-app/src/features/stats/top-items.tsx",
      "apps/web-app/src/features/stats/top-categories.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/stats/vat-recap.tsx",
    web: ["apps/web-app/src/features/stats/vat-recap.tsx"],
    status: "matched",
  },
  {
    native: "src/features/terminal-home/amount-keypad.tsx",
    web: [
      "apps/web-app/src/features/terminal-home/terminal-payment-keypad.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/terminal-home/pos-overview-page.tsx",
    web: ["apps/web-app/src/features/terminal-home/pos-overview-page.tsx"],
    status: "matched",
    allowedDifferences: {
      Button:
        "web draws its new-bill links as a Link styled with buttonVariants; native has no Link element, so they are ui/button",
    },
  },
  {
    native: "src/features/terminal-home/terminal-home-page.tsx",
    web: ["apps/web-app/src/features/terminal-home/terminal-home-page.tsx"],
    status: "matched",
    allowedDifferences: {
      SlidingPillTrack:
        "the mode switch is the kit's Tabs, whose pill slides on the native driver (navigation/0004)",
      ToggleGroup:
        "the mode switch is the kit's Tabs, whose pill slides on the native driver (navigation/0004)",
      ToggleGroupItem:
        "the mode switch is the kit's Tabs, whose pill slides on the native driver (navigation/0004)",
      SlidingPillSegmentContent:
        "the mode switch is the kit's Tabs, whose pill slides on the native driver (navigation/0004)",
      Tabs: "the mode switch, web's sliding-pill ToggleGroup (navigation/0004)",
      TabsList:
        "the mode switch, web's sliding-pill ToggleGroup (navigation/0004)",
      TabsTrigger:
        "the mode switch, web's sliding-pill ToggleGroup (navigation/0004)",
    },
  },
  {
    native: "src/features/withdraw/cashu-withdraw-form-step.tsx",
    web: ["apps/web-app/src/features/withdraw/cashu-withdraw-form-step.tsx"],
    status: "matched",
    allowedDifferences: {
      Card: "The common native form renders this shared shell in WithdrawFormFields, while the web Cashu screen owns its Card.",
      CardContent:
        "The common native form renders this shared shell in WithdrawFormFields, while the web Cashu screen owns its CardContent.",
      CardDescription:
        "The common native form renders this shared shell in WithdrawFormFields, while the web Cashu screen owns its CardDescription.",
      CardFooter:
        "The common native form renders this shared shell in WithdrawFormFields, while the web Cashu screen owns its CardFooter.",
      CardHeader:
        "The common native form renders this shared shell in WithdrawFormFields, while the web Cashu screen owns its CardHeader.",
      CardTitle:
        "The common native form renders this shared shell in WithdrawFormFields, while the web Cashu screen owns its CardTitle.",
      FieldError:
        "Quote errors render in the shared native WithdrawFormFields component.",
      FieldGroup:
        "The shared native WithdrawFormFields component groups the common form fields.",
    },
  },
  {
    native: "src/features/withdraw/cashu-withdraw-page.tsx",
    web: ["apps/web-app/src/features/withdraw/cashu-withdraw-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/withdraw/cashu-withdraw-review-step.tsx",
    web: ["apps/web-app/src/features/withdraw/cashu-withdraw-review-step.tsx"],
    status: "matched",
  },
  {
    native: "src/features/withdraw/cashu-send-review-step.tsx",
    web: [],
    status: "matched",
    note: "Finito's review of ecash to a Linky contact (withdraw/0015), which web cannot make; the same review card as the melt's.",
    allowedDifferences: {
      DetailRow: "the recipient, mint, amount, fee and total rows",
      Mono: "an npub recipient, as the melt review shows an invoice",
      SatsWithFiat: "the amounts with their fiat estimate",
      WithdrawReviewCard: "the shared review card with its confirm controls",
    },
  },
  {
    native: "src/features/withdraw/withdraw-detail-page.tsx",
    web: ["apps/web-app/src/features/withdraw/withdraw-detail-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/withdraw/withdraw-form-step.tsx",
    web: [
      "apps/web-app/src/features/withdraw/withdraw-form-step.tsx",
      "apps/web-app/src/features/withdraw/withdraw-amount-field.tsx",
      "apps/web-app/src/features/withdraw/withdraw-all-field.tsx",
    ],
    status: "matched",
    note: "Native has Paste but no 'Use from clipboard' suggestion: web reads the clipboard on open only when the browser grants it without asking, and Android announces every read (iOS and the web build prompt), so native reads it on Paste only.",
    allowedDifferences: {
      ScanCodeScanner:
        "Native adds QR scanning to fill the same destination field before review.",
    },
  },
  {
    native: "src/features/withdraw/withdraw-history-page.tsx",
    web: ["apps/web-app/src/features/withdraw/withdraw-history-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/withdraw/withdraw-no-account-card.tsx",
    web: ["apps/web-app/src/features/withdraw/withdraw-account.tsx"],
    status: "matched",
  },
  {
    native: "src/features/withdraw/withdraw-page.tsx",
    web: ["apps/web-app/src/features/withdraw/withdraw-page.tsx"],
    status: "matched",
  },
  {
    native: "src/features/withdraw/withdraw-parts.tsx",
    web: [
      "apps/web-app/src/features/withdraw/withdraw-collapsible.tsx",
      "apps/web-app/src/features/withdraw/withdraw-lightning-address.tsx",
      "apps/web-app/src/features/withdraw/withdraw-sats.tsx",
      "apps/web-app/src/features/withdraw/withdraw-status-badge.tsx",
    ],
    status: "matched",
  },
  {
    native: "src/features/withdraw/withdraw-review-step.tsx",
    web: ["apps/web-app/src/features/withdraw/withdraw-review-step.tsx"],
    status: "matched",
  },
  {
    native: "src/features/catalog/items/category-field.tsx",
    web: [],
    status: "matched",
    note: "Finito makes a category on the item (navigation/0003): chips of the existing ones and a field for a new name, where web's item form picks from a Select and categories have screens of their own.",
    allowedDifferences: {
      Field:
        "the category field's anatomy, as web's item form draws it around its Select",
      FieldLabel: "the category field's label",
      ToggleGroup: "the existing categories as chips, one selected",
      ToggleGroupItem: "one category chip",
      Input: "the new category's name",
      Button:
        "Save and Discard inside the field while a name is typed, as InlineEditField",
    },
  },
  {
    native: "src/features/settings/payment-accounts/bitcoin-settings-page.tsx",
    web: [],
    status: "matched",
    note: "Finito's one Bitcoin method (settings/0003): the Cashu, Lightning address and Spark bodies as tabs to look at, which web lists as three methods, and a switch making the shown wallet the main one.",
    allowedDifferences: {
      FadeHeader: "the screen's title, Bitcoin",
      Tabs: "the wallet to look at, Cashu, the Lightning address or Spark, as Activity's tabs",
      TabsList:
        "the wallet to look at, Cashu, the Lightning address or Spark, as Activity's tabs",
      TabsTrigger:
        "the wallet to look at, Cashu, the Lightning address or Spark, as Activity's tabs",
      Switch:
        "the main-method switch (settings/0003), which web has as a switch per method row",
    },
  },
  {
    native: "src/features/notifications/notification-renderers.tsx",
    web: ["apps/web-app/src/features/notifications/notification-renderers.tsx"],
    status: "matched",
  },
  {
    native: "src/features/notifications/notifications-page.tsx",
    web: ["apps/web-app/src/features/notifications/notifications-page.tsx"],
    status: "matched",
    allowedDifferences: {
      MenuBarSpacer:
        "the room under the bottom bar, which native draws over its stack (MenuBar); web's _terminal layout draws the bar beside the page",
    },
  },
  {
    native: "src/features/settings/home-screen/home-screen-settings-page.tsx",
    web: [
      "apps/web-app/src/features/settings/home-screen/home-screen-settings-page.tsx",
    ],
    status: "matched",
    allowedDifferences: {
      Card: "no card on a mobile detail screen; the switches sit on the page",
      CardHeader:
        "no card on a mobile detail screen; the switches sit on the page",
      CardTitle:
        "no card on a mobile detail screen; the switches sit on the page",
      CardDescription: "no second-line explanations (fazole-ui-minimal-copy)",
      CardContent:
        "no card on a mobile detail screen; the switches sit on the page",
      FieldGroup: "the switches sit on the page, one SwitchRow each",
      InlineEditSwitch:
        "native's SwitchRow over useInlineChoice, as the tips switch",
      SwitchRow: "web's InlineEditSwitch, as the tips switch",
    },
  },
  {
    native: "src/features/shared/wallet-body.tsx",
    web: [],
    status: "matched",
    note: "Fazole's wallet screen shared by the Cashu and Spark wallets: the balance, Withdraw funds while funded, the wallet's rows; web draws each wallet's card on its own.",
    allowedDifferences: {
      Button: "Withdraw funds under the balance",
      VerticalNav: "the wallet's rows",
    },
  },
  {
    native: "src/features/shared/bitcoin-amount.tsx",
    web: [],
    status: "matched",
    note: "Finito reads every bitcoin amount in one unit at a time, the shop's money or sats, switched by a tap (`bitcoinUnitAtom`); web's SatsWithFiat shows both.",
  },
  {
    native: "src/features/shared/activity-tabs.tsx",
    web: ["apps/web-app/src/features/shared/activity-tabs.tsx"],
    status: "matched",
  },
]
