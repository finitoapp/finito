import { brandName } from "@payky/app-shared/brand"
import { appBrand } from "../core/app-brand.ts"
import { appTitle } from "../core/app-title.cjs"

/**
 * Names the tab of Expo's dev server (`expo start --web`) "Finito dev"
 * (brand/0005), as the dev server serves `public/index.html` untouched. An
 * export is a production bundle, whose `index.html` and manifest the build
 * script names after its channel instead (`scripts/build-web.ts`).
 */
if (__DEV__) document.title = appTitle(brandName(appBrand), "dev")
