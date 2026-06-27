export interface SiteConfig {
	name: string;
	url: string;
	description: string;
	author: string;
	language: string;
	comments: CommentConfig;
}

export interface CommentConfig {
	provider: "giscus";
	repo: string;
	repoId: string;
	category: string;
	categoryId: string;
	mapping: "pathname" | "url" | "title" | "og:title";
	strict: boolean;
	reactionsEnabled: boolean;
	inputPosition: "top" | "bottom";
	lang: string;
}

export const siteConfig: SiteConfig = {
	name: "SengokuCola 的主页",
	url: "https://home.nibutupaopao.top",
	description: "SengokuCola 的主页",
	author: "SengokuCola",
	language: "zh-CN",
	comments: {
		provider: "giscus",
		repo: "LQWXHN/cf-astro-blog",
		repoId: "R_kgDOTAArAg",
		category: "Announcements",
		categoryId: "DIC_kwDOTAArAs4C_hsd",
		mapping: "pathname",
		strict: false,
		reactionsEnabled: true,
		inputPosition: "top",
		lang: "zh-CN",
	},
};

export interface PaginationParams {
	page: number;
	limit: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export type PostStatus = "draft" | "published" | "scheduled";
