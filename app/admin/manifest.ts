import type { MetadataRoute } from "next";
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Finito POS",
		short_name: "Finito POS",
		description: "Make business payments self-custody again",
		start_url: "/admin",
		display: "fullscreen",
		orientation: "portrait",
		background_color: "#e8ebed",
		theme_color: "#e8ebed",
		icons: [
			{
				src: "/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
	};
}
