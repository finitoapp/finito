"use client";

import { AiAssistantChat } from "@/app/admin/(private)/ai-assistant/ai-assistant-chat";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
	return (
		<div className="w-full max-w-4xl">
			<Card>
				<CardContent>
					<AiAssistantChat />
				</CardContent>
			</Card>
		</div>
	);
}
