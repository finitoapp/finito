import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST;
const isE2eBuild = process.env.FINITO_E2E === "1";

const nextConfig: NextConfig = {
	output: "export",
	distDir: isE2eBuild ? ".next-e2e" : ".next",
	typedRoutes: true,
	experimental: {
		viewTransition: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "raw.githubusercontent.com",
			},
		],
	},
	allowedDevOrigins: ["127.0.0.1"],
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
