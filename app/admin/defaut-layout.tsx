import { SiteHeader } from "@/components/site-header";

export const DefautLayout = (props: {
	title?: string;
	children: React.ReactNode;
}) => (
	<>
		<SiteHeader title={props.title} />
		<div className="flex flex-1 flex-col">
			<div className="flex flex-1 flex-col gap-2">
				<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
					<div className="px-0 sm:px-4 lg:px-6 flex justify-center">
						{props.children}
					</div>
				</div>
			</div>
		</div>
	</>
);
