"use client";

import { useTranslation } from "react-i18next";
import {
	Heart,
	MessageCircle,
	MoreHorizontal,
	Repeat2,
	Share,
	Zap,
} from "lucide-react";
import { ResponsiveCard } from "@/components/responsive-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader } from "@/components/ui/card";

// Mock data for Nostr posts
const posts = [
	{
		id: "1",
		author: {
			name: "Alice Johnson",
			username: "alice",
			avatar: "/placeholder.svg?height=40&width=40",
			npub: "npub1alice...",
		},
		content:
			"Just discovered this amazing decentralized protocol! The future of social media is here. #nostr #decentralized",
		timestamp: "2h",
		likes: 24,
		reposts: 8,
		replies: 12,
		zaps: 5,
	},
	{
		id: "2",
		author: {
			name: "Bob Smith",
			username: "bobsmith",
			avatar: "/placeholder.svg?height=40&width=40",
			npub: "npub1bob...",
		},
		content:
			"Building on Nostr feels like the early days of the web. So much potential for innovation and creativity. What are you building?",
		timestamp: "4h",
		likes: 18,
		reposts: 6,
		replies: 9,
		zaps: 12,
	},
	{
		id: "3",
		author: {
			name: "Carol Davis",
			username: "carol_dev",
			avatar: "/placeholder.svg?height=40&width=40",
			npub: "npub1carol...",
		},
		content:
			"GM Nostr! ☀️ Working on a new client that focuses on privacy and user experience. Can't wait to share it with everyone!",
		timestamp: "6h",
		likes: 31,
		reposts: 14,
		replies: 7,
		zaps: 8,
	},
	{
		id: "4",
		author: {
			name: "David Wilson",
			username: "dwilson",
			avatar: "/placeholder.svg?height=40&width=40",
			npub: "npub1david...",
		},
		content:
			"The beauty of Nostr is that your identity and data belong to you. No more platform lock-in, no more censorship. True digital freedom! 🔓",
		timestamp: "8h",
		likes: 42,
		reposts: 19,
		replies: 15,
		zaps: 23,
	},
	{
		id: "5",
		author: {
			name: "Eva Martinez",
			username: "eva_crypto",
			avatar: "/placeholder.svg?height=40&width=40",
			npub: "npub1eva...",
		},
		content:
			"Just zapped ⚡ my first sats on Nostr! The Lightning integration is seamless. This is how social media should work.",
		timestamp: "12h",
		likes: 28,
		reposts: 11,
		replies: 6,
		zaps: 17,
	},
	{
		id: "6",
		author: {
			name: "Frank Chen",
			username: "frankc",
			avatar: "/placeholder.svg?height=40&width=40",
			npub: "npub1frank...",
		},
		content:
			"Excited to see more developers joining Nostr! The protocol is simple yet powerful. Let's build the future of decentralized communication together. 🚀",
		timestamp: "1d",
		likes: 56,
		reposts: 22,
		replies: 18,
		zaps: 31,
	},
];

export function NostrPosts(props: { posts?: typeof posts }) {
	const { t } = useTranslation();
	return (
		<div className="max-w-2xl mx-auto space-y-4">
			<div className="text-center mb-8">
				<h1 className="text-3xl font-bold mb-2">{t("components:nostrPosts.nostrPosts")}</h1>
				<p className="text-muted-foreground">{t("components:nostrPosts.decentralizedSocialMediaFeed")}</p>
			</div>

			<div className="space-y-4">
				{(props.posts ?? posts).map((post) => (
					<ResponsiveCard key={post.id} className="w-full">
						<CardHeader className="pb-3">
							<div className="flex items-start justify-between">
								<div className="flex items-center space-x-3">
									<Avatar className="h-10 w-10">
										<AvatarImage
											src={post.author.avatar || "/placeholder.svg"}
											alt={post.author.name}
										/>
										<AvatarFallback>
											{post.author.name
												.split(" ")
												.map((n) => n[0])
												.join("")}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-col">
										<div className="flex items-center space-x-2">
											<span className="font-semibold text-sm">
												{post.author.name}
											</span>
											<span className="text-muted-foreground text-sm">
												@{post.author.username}
											</span>
											<span className="text-muted-foreground text-sm">·</span>
											<span className="text-muted-foreground text-sm">
												{post.timestamp}
											</span>
										</div>
										<span className="text-xs text-muted-foreground font-mono">
											{post.author.npub}
										</span>
									</div>
								</div>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</div>
						</CardHeader>

						<CardContent className="pt-0">
							<p className="text-sm mb-4 leading-relaxed">{post.content}</p>

							<div className="flex items-center justify-between max-w-md">
								<Button
									variant="ghost"
									size="sm"
									className="flex items-center space-x-2 text-muted-foreground hover:text-blue-600"
								>
									<MessageCircle className="h-4 w-4" />
									<span className="text-xs">{post.replies}</span>
								</Button>

								<Button
									variant="ghost"
									size="sm"
									className="flex items-center space-x-2 text-muted-foreground hover:text-green-600"
								>
									<Repeat2 className="h-4 w-4" />
									<span className="text-xs">{post.reposts}</span>
								</Button>

								<Button
									variant="ghost"
									size="sm"
									className="flex items-center space-x-2 text-muted-foreground hover:text-red-600"
								>
									<Heart className="h-4 w-4" />
									<span className="text-xs">{post.likes}</span>
								</Button>

								<Button
									variant="ghost"
									size="sm"
									className="flex items-center space-x-2 text-muted-foreground hover:text-yellow-600"
								>
									<Zap className="h-4 w-4" />
									<span className="text-xs">{post.zaps}</span>
								</Button>

								<Button
									variant="ghost"
									size="sm"
									className="text-muted-foreground hover:text-blue-600"
								>
									<Share className="h-4 w-4" />
								</Button>
							</div>
						</CardContent>
					</ResponsiveCard>
				))}
			</div>

			<div className="text-center py-8">
				<Button variant="outline" className="w-full bg-transparent">
					Load More Posts
				</Button>
			</div>
		</div>
	);
}
