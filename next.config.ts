import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST;

const nextConfig: NextConfig = {
	output: "export",
	typedRoutes: true,
	experimental: {
		viewTransition: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		unoptimized: true,
	},
	assetPrefix: isProd
		? undefined
		: internalHost
			? `http://${internalHost}:3000`
			: undefined,
	turbopack: {
		resolveAlias: {
			buffer: "./buffer-mock.ts",
		},
	},
};

export default nextConfig;
