export default function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div className="bg-background flex flex-1 items-center justify-center px-4 py-8">
			<div className="w-full max-w-xl">{children}</div>
		</div>
	);
}
