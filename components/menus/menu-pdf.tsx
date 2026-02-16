"use client";

import {
	Document,
	Font,
	Page,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import type React from "react";

Font.register({
	family: "Roboto",
	fonts: [
		{
			src: "/font/Roboto-Regular.ttf",
			fontWeight: 400,
		},
		{
			src: "/font/Roboto-Bold.ttf",
			fontWeight: 700,
		},
	],
});

const styles = StyleSheet.create({
	page: {
		backgroundColor: "#ffffff",
		paddingHorizontal: 28,
		paddingVertical: 24,
		fontFamily: "Roboto",
		fontSize: 11,
		lineHeight: 1.4,
		color: "#111827",
	},
	header: {
		width: "100%",
		marginBottom: 14,
	},
	titleWrap: {
		width: "100%",
		marginBottom: 8,
	},
	title: {
		fontSize: 24,
		fontWeight: 700,
		lineHeight: 1.2,
		textAlign: "center",
		paddingHorizontal: 12,
	},
	validity: {
		fontSize: 10,
		fontWeight: 700,
		lineHeight: 1.3,
		color: "#374151",
		textAlign: "center",
		paddingHorizontal: 12,
	},
	separator: {
		borderBottomWidth: 1,
		borderBottomColor: "#111827",
		marginBottom: 8,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "bold",
		marginTop: 14,
		marginBottom: 6,
		textTransform: "uppercase",
		letterSpacing: 0.8,
	},
	categoryBlock: {
		marginBottom: 10,
	},
	categoryTitle: {
		fontSize: 12,
		fontWeight: "bold",
		paddingVertical: 5,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderTopColor: "#d1d5db",
		borderBottomColor: "#d1d5db",
		backgroundColor: "#f9fafb",
		paddingHorizontal: 6,
	},
	itemRow: {
		flexDirection: "row",
		alignItems: "baseline",
		paddingHorizontal: 6,
		paddingVertical: 4,
	},
	itemLabel: {
		flex: 1,
		paddingRight: 6,
		fontSize: 11,
	},
	itemLeader: {
		flexGrow: 1,
		borderBottomWidth: 1,
		borderStyle: "dotted",
		borderBottomColor: "#9ca3af",
		marginHorizontal: 8,
		marginBottom: 3,
	},
	itemAmount: {
		width: 110,
		textAlign: "right",
		fontSize: 11,
		fontWeight: "bold",
	},
	emptyText: {
		paddingHorizontal: 6,
		paddingVertical: 6,
		color: "#6b7280",
		fontStyle: "italic",
	},
});

export type MenuPdfData = {
	name: string;
	validityLabel: string | null;
	emptyLabel: string;
	categoriesLabel: string;
	categories: Array<{
		id: string;
		name: string;
		items: Array<{
			id: string;
			label: string;
			amountLabel: string;
		}>;
	}>;
};

export const MenuPdfTemplate: React.FC<{
	menu: MenuPdfData;
}> = ({ menu }) => {
	return (
		<Document>
			<Page size="A4" style={styles.page}>
				<View style={styles.header}>
					<View style={styles.titleWrap}>
						<Text style={styles.title}>{menu.name}</Text>
					</View>
					{menu.validityLabel && (
						<Text style={styles.validity}>{menu.validityLabel}</Text>
					)}
				</View>
				<View style={styles.separator}></View>

				<Text style={styles.sectionTitle}>{menu.categoriesLabel}</Text>
				{menu.categories.length === 0 && (
					<Text style={styles.emptyText}>{menu.emptyLabel}</Text>
				)}
				{menu.categories.map((category) => (
					<View key={category.id} style={styles.categoryBlock}>
						<Text style={styles.categoryTitle}>{category.name}</Text>
						{category.items.length === 0 && (
							<Text style={styles.emptyText}>{menu.emptyLabel}</Text>
						)}
						{category.items.map((item) => (
							<View key={item.id} style={styles.itemRow}>
								<Text style={styles.itemLabel}>{item.label}</Text>
								<View style={styles.itemLeader}></View>
								<Text style={styles.itemAmount}>{item.amountLabel}</Text>
							</View>
						))}
					</View>
				))}
			</Page>
		</Document>
	);
};
