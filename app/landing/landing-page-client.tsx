"use client";

import {
	IconBrandGithub,
	IconBrandX,
	IconBuildingStore,
	IconDeviceMobile,
	IconRouteSquare,
	IconShieldLock,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FinitoLogo } from "@/components/finito-logo";
import { LanguageToggle } from "@/components/language-toggle";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const githubUrl = "https://github.com/finitoapp/finito";
const xUrl = "https://x.com/finito_app";

const screenshots = [
	{
		id: "s1",
		src: "https://raw.githubusercontent.com/finitoapp/finito/main/.github/screenshot1.webp",
	},
	{
		id: "s2",
		src: "https://raw.githubusercontent.com/finitoapp/finito/main/.github/screenshot2.webp",
	},
	{
		id: "s3",
		src: "https://raw.githubusercontent.com/finitoapp/finito/main/.github/screenshot3.webp",
	},
] as const;

export const LandingPageClient: React.FC = () => {
	const { t } = useTranslation();
	const [claimIndex, setClaimIndex] = useState(0);
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	const heroClaims = useMemo(
		() => [
			t("landing:page.hero.finitoClaim1"),
			t("landing:page.hero.finitoClaim2"),
			t("landing:page.hero.finitoClaim3"),
			t("landing:page.hero.finitoClaim4"),
		],
		[t],
	);

	const clientPoints = useMemo(
		() => [
			t("landing:page.perspectives.clientPoint1"),
			t("landing:page.perspectives.clientPoint2"),
			t("landing:page.perspectives.clientPoint3"),
			t("landing:page.perspectives.clientPoint4"),
		],
		[t],
	);
	const businessPoints = useMemo(
		() => [
			t("landing:page.perspectives.businessPoint1"),
			t("landing:page.perspectives.businessPoint2"),
			t("landing:page.perspectives.businessPoint3"),
			t("landing:page.perspectives.businessPoint4"),
		],
		[t],
	);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setPrefersReducedMotion(media.matches);
		sync();
		media.addEventListener("change", sync);
		return () => {
			media.removeEventListener("change", sync);
		};
	}, []);

	useEffect(() => {
		if (prefersReducedMotion || heroClaims.length <= 1) {
			setClaimIndex(0);
			return;
		}
		const interval = window.setInterval(() => {
			setClaimIndex((current) => (current + 1) % heroClaims.length);
		}, 3800);
		return () => {
			window.clearInterval(interval);
		};
	}, [heroClaims.length, prefersReducedMotion]);

	return (
		<main className="relative w-full overflow-x-clip">
			<section className="relative border-b bg-linear-to-b from-primary/18 via-background to-background">
				<div className="pointer-events-none absolute -top-16 -left-20 size-72 rounded-full bg-primary/15 blur-3xl" />
				<div className="pointer-events-none absolute -right-20 top-10 size-80 rounded-full bg-primary/10 blur-3xl" />
				<div className="container py-12 md:py-20">
					<div className="mx-auto max-w-5xl">
						<motion.div
							initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.45, ease: "easeOut" }}
							className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 px-5 py-6 text-center shadow-xl backdrop-blur-sm sm:px-8 sm:py-8 md:px-12 md:py-12"
						>
							<div className="pointer-events-none absolute -right-10 -bottom-10 size-56 rounded-full bg-primary/10 blur-2xl" />
							<div className="mb-6 flex items-start justify-between">
								<Badge variant="secondary" className="mt-0.5">
									{t("landing:page.hero.eyebrow")}
								</Badge>
								<LanguageToggle />
							</div>
							<h1 className="flex justify-center text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
								<FinitoLogo className="text-4xl md:text-6xl" />
							</h1>
							<div
								className="mx-auto mt-6 mb-5 flex min-h-20 max-w-3xl items-center justify-center"
								aria-live="polite"
							>
								<AnimatePresence mode="wait" initial={false}>
									<motion.p
										key={heroClaims[claimIndex]}
										initial={
											prefersReducedMotion ? false : { opacity: 0, y: 8 }
										}
										animate={{ opacity: 1, y: 0 }}
										exit={prefersReducedMotion ? {} : { opacity: 0, y: -8 }}
										transition={{ duration: 0.28, ease: "easeOut" }}
										className="max-w-3xl text-xl font-semibold text-primary md:text-3xl"
									>
										{heroClaims[claimIndex]}
									</motion.p>
								</AnimatePresence>
							</div>
							<p className="mx-auto mt-4 max-w-3xl text-sm text-muted-foreground md:text-lg">
								{t("landing:page.hero.subtitle")}
							</p>
							<div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
								<Button
									size="lg"
									className="rounded-full"
									render={<Link href="/" />}
								>
									<IconDeviceMobile />
									{t("landing:page.hero.ctaClient")}
								</Button>
								<Button
									size="lg"
									variant="outline"
									className="rounded-full"
									render={<Link href="/admin" />}
								>
									<IconBuildingStore />
									{t("landing:page.hero.ctaAdmin")}
								</Button>
								<Button
									size="lg"
									variant="ghost"
									className="rounded-full"
									render={
										<a
											href={githubUrl}
											target="_blank"
											rel="noopener noreferrer"
										>
											<IconBrandGithub />
											{t("landing:page.hero.ctaGithub")}
										</a>
									}
								></Button>
								<Button
									size="lg"
									variant="ghost"
									className="rounded-full"
									render={
										<a href={xUrl} target="_blank" rel="noopener noreferrer">
											<IconBrandX />
											{t("landing:page.hero.ctaX")}
										</a>
									}
								></Button>
							</div>
							<div className="mt-5 flex flex-wrap items-center justify-center gap-2">
								<span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
									{t("landing:page.localFirst.point1Title")}
								</span>
								<span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
									{t("landing:page.localFirst.point2Title")}
								</span>
								<span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
									{t("landing:page.localFirst.point3Title")}
								</span>
							</div>
							<p className="mt-4 text-xs text-muted-foreground">
								{t("landing:page.hero.note")}
							</p>
						</motion.div>
					</div>
				</div>
			</section>

			<section className="container py-12 md:py-16">
				<div className="mb-6 max-w-3xl">
					<h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
						{t("landing:page.perspectives.title")}
					</h2>
					<p className="mt-2 text-muted-foreground">
						{t("landing:page.perspectives.subtitle")}
					</p>
				</div>
				<div className="grid gap-4 lg:grid-cols-2">
					<Card className="border-border/70 bg-card/70 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10">
									<IconDeviceMobile className="size-5 text-primary" />
								</span>
								{t("landing:page.perspectives.clientTitle")}
							</CardTitle>
							<CardDescription>
								{t("landing:page.perspectives.clientLead")}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							{clientPoints.map((point) => (
								<div key={point} className="flex items-start gap-2">
									<CheckCircle2Icon className="mt-0.5 size-4 text-primary" />
									<span>{point}</span>
								</div>
							))}
						</CardContent>
					</Card>
					<Card className="border-border/70 bg-card/70 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10">
									<IconBuildingStore className="size-5 text-primary" />
								</span>
								{t("landing:page.perspectives.businessTitle")}
							</CardTitle>
							<CardDescription>
								{t("landing:page.perspectives.businessLead")}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							{businessPoints.map((point) => (
								<div key={point} className="flex items-start gap-2">
									<CheckCircle2Icon className="mt-0.5 size-4 text-primary" />
									<span>{point}</span>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</section>

			<section className="border-y bg-muted/25">
				<div className="container py-12 md:py-16">
					<h2 className="mb-6 text-2xl font-semibold tracking-tight md:text-3xl">
						{t("landing:page.how.title")}
					</h2>
					<div className="grid gap-4 md:grid-cols-3">
						<Card className="border-dashed border-border/70 bg-card/70 backdrop-blur-sm">
							<CardHeader>
								<CardTitle>{t("landing:page.how.step1Title")}</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								{t("landing:page.how.step1Body")}
							</CardContent>
						</Card>
						<Card className="border-dashed border-border/70 bg-card/70 backdrop-blur-sm">
							<CardHeader>
								<CardTitle>{t("landing:page.how.step2Title")}</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								{t("landing:page.how.step2Body")}
							</CardContent>
						</Card>
						<Card className="border-dashed border-border/70 bg-card/70 backdrop-blur-sm">
							<CardHeader>
								<CardTitle>{t("landing:page.how.step3Title")}</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								{t("landing:page.how.step3Body")}
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			<section className="container py-12 md:py-16">
				<div className="grid gap-4 lg:grid-cols-2">
					<Card className="h-full border-border/70 bg-card/70 backdrop-blur-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<IconShieldLock className="size-5 text-primary" />
								{t("landing:page.localFirst.title")}
							</CardTitle>
							<CardDescription>
								{t("landing:page.localFirst.lead")}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<div>
								<div className="font-medium">
									{t("landing:page.localFirst.point1Title")}
								</div>
								<div className="text-muted-foreground">
									{t("landing:page.localFirst.point1Body")}
								</div>
							</div>
							<div>
								<div className="font-medium">
									{t("landing:page.localFirst.point2Title")}
								</div>
								<div className="text-muted-foreground">
									{t("landing:page.localFirst.point2Body")}
								</div>
							</div>
							<div>
								<div className="font-medium">
									{t("landing:page.localFirst.point3Title")}
								</div>
								<div className="text-muted-foreground">
									{t("landing:page.localFirst.point3Body")}
								</div>
							</div>
						</CardContent>
					</Card>
					<Card className="h-full border-border/70 bg-card/70 backdrop-blur-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<IconRouteSquare className="size-5 text-primary" />
								{t("landing:page.roadmap.title")}
							</CardTitle>
							<CardDescription>
								{t("landing:page.roadmap.lead")}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<div className="rounded-md border border-border/70 bg-muted/35 px-3 py-2">
								{t("landing:page.roadmap.now1")}
							</div>
							<div className="rounded-md border border-border/70 bg-muted/35 px-3 py-2">
								{t("landing:page.roadmap.now2")}
							</div>
							<div className="rounded-md border border-dashed px-3 py-2 text-muted-foreground">
								{t("landing:page.roadmap.next1")}
							</div>
							<div className="rounded-md border border-dashed px-3 py-2 text-muted-foreground">
								{t("landing:page.roadmap.next2")}
							</div>
						</CardContent>
					</Card>
				</div>
			</section>

			<section className="border-y bg-muted/25">
				<div className="container py-12 md:py-16">
					<div className="grid gap-4 lg:grid-cols-2">
						<Card className="border-border/70 bg-card/70 backdrop-blur-sm">
							<CardHeader>
								<CardTitle>{t("landing:page.media.title")}</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="rounded-md border border-border/70 p-3">
									<div className="mb-1 flex items-center gap-2 font-medium">
										<IconBrandGithub className="size-4 text-primary" />
										{t("landing:page.media.githubTitle")}
									</div>
									<div className="text-sm text-muted-foreground">
										{t("landing:page.media.githubBody")}
									</div>
									<Button
										variant="ghost"
										className="mt-2 px-0"
										render={
											<a
												href={githubUrl}
												target="_blank"
												rel="noopener noreferrer"
											>
												{t("landing:page.media.githubCta")}
												<ArrowRightIcon />
											</a>
										}
									></Button>
								</div>
								<div className="rounded-md border border-border/70 p-3">
									<div className="mb-1 flex items-center gap-2 font-medium">
										<IconBrandX className="size-4 text-primary" />
										{t("landing:page.media.xTitle")}
									</div>
									<div className="text-sm text-muted-foreground">
										{t("landing:page.media.xBody")}
									</div>
									<Button
										variant="ghost"
										className="mt-2 px-0"
										render={
											<a href={xUrl} target="_blank" rel="noopener noreferrer">
												{t("landing:page.media.xCta")}
												<ArrowRightIcon />
											</a>
										}
									></Button>
								</div>
							</CardContent>
						</Card>
						<Card className="border-border/70 bg-card/70 backdrop-blur-sm">
							<CardHeader>
								<CardTitle>{t("landing:page.faq.title")}</CardTitle>
							</CardHeader>
							<CardContent>
								<Accordion>
									<AccordionItem value="q1">
										<AccordionTrigger>
											{t("landing:page.faq.q1")}
										</AccordionTrigger>
										<AccordionContent>
											{t("landing:page.faq.a1")}
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="q2">
										<AccordionTrigger>
											{t("landing:page.faq.q2")}
										</AccordionTrigger>
										<AccordionContent>
											{t("landing:page.faq.a2")}
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="q3">
										<AccordionTrigger>
											{t("landing:page.faq.q3")}
										</AccordionTrigger>
										<AccordionContent>
											{t("landing:page.faq.a3")}
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="q4">
										<AccordionTrigger>
											{t("landing:page.faq.q4")}
										</AccordionTrigger>
										<AccordionContent>
											{t("landing:page.faq.a4")}
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			<section className="container py-12">
				<h2 className="mb-4 text-lg font-semibold">
					{t("landing:page.media.screensTitle")}
				</h2>
				<div className="grid gap-4 md:grid-cols-3">
					{screenshots.map((screenshot, index) => (
						<Card
							key={screenshot.id}
							className="overflow-hidden border-border/70 bg-card/70 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-lg"
						>
							<Image
								src={screenshot.src}
								alt={t(`landing:page.media.screenshot${index + 1}Alt` as const)}
								width={1200}
								height={760}
								className="w-full object-cover transition duration-300 hover:scale-[1.02]"
							/>
						</Card>
					))}
				</div>
			</section>

			<section className="border-t bg-linear-to-b from-muted/40 to-background">
				<div className="container py-12 text-center">
					<h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
						{t("landing:page.footer.title")}
					</h2>
					<p className="mx-auto mt-2 max-w-3xl text-muted-foreground">
						{t("landing:page.footer.body")}
					</p>
					<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
						<Button className="rounded-full" render={<Link href="/admin" />}>
							{t("landing:page.hero.ctaAdmin")}
						</Button>
						<Button
							variant="outline"
							className="rounded-full"
							render={<Link href="/" />}
						>
							{t("landing:page.hero.ctaClient")}
						</Button>
					</div>
				</div>
			</section>
		</main>
	);
};
