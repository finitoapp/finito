import { describe, expect, it, jest, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import Page from "./page";

const mockRouterReplace = jest.fn();
const mockRouterRefresh = jest.fn();
const mockRouterPush = jest.fn();

mock.module("next/navigation", () => {
	return {
		__esModule: true,
		useRouter: mock(() => {
			return {
				push: mockRouterPush,
				replace: mockRouterReplace,
				refresh: mockRouterRefresh,
			};
		}),
		useSearchParams: mock(() => {
			return new URLSearchParams(window.location.search);
		}),
		usePathname: mock((pathArg) => {
			return pathArg;
		}),
	};
});

describe("(dashboard) / page", () => {
	render(<Page />);

	it("Should render", () => {
		expect(screen.getByTestId("text")).toHaveTextContent(
			"admin:dashboard.home.subtitle",
		);
	});

	it("Should click", () => {
		const itemsCard = screen.getByTestId("items");

		itemsCard.click();

		expect(mockRouterPush).toHaveBeenCalledTimes(1);
		expect(mockRouterPush).toHaveBeenLastCalledWith("/admin/catalog");
	});
});
