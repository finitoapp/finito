import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	return (
		<div className="w-full lg:max-w-7xl">
			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_22rem]">
				<div className="flex min-w-0 flex-col gap-4">
					<Card>
						<CardHeader>
							<CardTitle>Sklad položky</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								Tato podstránka je zatím připravená bez dalších dat.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
