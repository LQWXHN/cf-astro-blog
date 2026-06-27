import { Hono } from "hono";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { toolCategories, toolItems } from "@/db/schema";
import { getDb } from "@/lib/db"; // 🆕 导入 getDb
import { escapeAttribute, escapeHtml } from "@/lib/security";
import {
  type AdminAppEnv,
  assertCsrfToken,
  getAuthenticatedSession,
  getBodyText,
  requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";

const tools = new Hono<AdminAppEnv>();
tools.use("*", requireAuth);

// ============ 工具管理首页 ============
tools.get("/", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const db = getDb(c.env.DB); // 🆕 使用 getDb 包装

    // 获取所有分类及其工具数量
    const categories = await db
      .select({
        id: toolCategories.id,
        name: toolCategories.name,
        sortOrder: toolCategories.sortOrder,
        count: sql<number>`count(${toolItems.id})`.as("count"),
      })
      .from(toolCategories)
      .leftJoin(toolItems, eq(toolCategories.id, toolItems.categoryId))
      .groupBy(toolCategories.id)
      .orderBy(asc(toolCategories.sortOrder), asc(toolCategories.name));

    // ... 后续内容不变，但同样需要将每个路由中的 c.env.DB 替换为 getDb(c.env.DB)
    // 为了简洁，下面只显示修改后的路由开头，其他路由请自行替换。

    const content = `...`; // 保持原有内容
    return c.html(adminLayout("工具箱管理", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    console.error("Tools page error:", error);
    return c.text(`❌ 错误: ${error.message}\n\n堆栈:\n${error.stack}`, 500);
  }
});

// 其他路由同样修改：在每个路由内部将 const db = c.env.DB; 替换为 const db = getDb(c.env.DB);
// 例如：
tools.get("/categories/new", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    // const db = c.env.DB; // 删除这一行
    // 不需要 db 时可以不写，但如果需要就使用 getDb
    const content = `...`;
    return c.html(adminLayout("新建分类", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

tools.post("/categories", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const name = getBodyText(body, "name").trim();
    const sortOrder = Number.parseInt(getBodyText(body, "sortOrder")) || 0;
    if (!name) {
      return c.text("分类名称不能为空", 400);
    }
    const db = getDb(c.env.DB); // 🆕
    await db.insert(toolCategories).values({ name, sortOrder });
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

tools.get("/categories/:id/edit", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB); // 🆕
    const [category] = await db
      .select()
      .from(toolCategories)
      .where(eq(toolCategories.id, id));
    if (!category) return c.notFound();
    const content = `...`;
    return c.html(adminLayout("编辑分类", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

tools.post("/categories/:id", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const name = getBodyText(body, "name").trim();
    const sortOrder = Number.parseInt(getBodyText(body, "sortOrder")) || 0;
    if (!name) return c.text("分类名称不能为空", 400);
    const db = getDb(c.env.DB); // 🆕
    await db
      .update(toolCategories)
      .set({ name, sortOrder, updatedAt: new Date().toISOString() })
      .where(eq(toolCategories.id, id));
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

tools.post("/categories/:id/delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const db = getDb(c.env.DB); // 🆕
    await db.delete(toolCategories).where(eq(toolCategories.id, id));
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

// ============ 工具条目管理 ============
tools.get("/items/new", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const db = getDb(c.env.DB); // 🆕
    const categories = await db
      .select()
      .from(toolCategories)
      .orderBy(asc(toolCategories.sortOrder), asc(toolCategories.name));
    const categoryOptions = categories
      .map(
        (cat) =>
          `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`
      )
      .join("");
    const content = `...`;
    return c.html(adminLayout("新建工具", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

tools.post("/items", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const name = getBodyText(body, "name").trim();
    const description = getBodyText(body, "description").trim();
    const url = getBodyText(body, "url").trim();
    const icon = getBodyText(body, "icon").trim();
    const categoryId = Number.parseInt(getBodyText(body, "categoryId"));
    const sortOrder = Number.parseInt(getBodyText(body, "sortOrder")) || 0;
    if (!name || !url || !categoryId) {
      return c.text("名称、URL和分类为必填项", 400);
    }
    const db = getDb(c.env.DB); // 🆕
    await db.insert(toolItems).values({
      name,
      description,
      url,
      icon: icon || null,
      categoryId,
      sortOrder,
    });
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

tools.get("/items/:id/edit", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB); // 🆕
    const [item] = await db
      .select()
      .from(toolItems)
      .where(eq(toolItems.id, id));
    if (!item) return c.notFound();
    const categories = await db
      .select()
      .from(toolCategories)
      .orderBy(asc(toolCategories.sortOrder), asc(toolCategories.name));
    const categoryOptions = categories
      .map(
        (cat) =>
          `<option value="${cat.id}" ${cat.id === item.categoryId ? "selected" : ""}>${escapeHtml(cat.name)}</option>`
      )
      .join("");
    const content = `...`;
    return c.html(adminLayout("编辑工具", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

tools.post("/items/:id", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const name = getBodyText(body, "name").trim();
    const description = getBodyText(body, "description").trim();
    const url = getBodyText(body, "url").trim();
    const icon = getBodyText(body, "icon").trim();
    const categoryId = Number.parseInt(getBodyText(body, "categoryId"));
    const sortOrder = Number.parseInt(getBodyText(body, "sortOrder")) || 0;
    if (!name || !url || !categoryId) {
      return c.text("名称、URL和分类为必填项", 400);
    }
    const db = getDb(c.env.DB); // 🆕
    await db
      .update(toolItems)
      .set({
        name,
        description,
        url,
        icon: icon || null,
        categoryId,
        sortOrder,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(toolItems.id, id));
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

tools.post("/items/:id/delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const db = getDb(c.env.DB); // 🆕
    await db.delete(toolItems).where(eq(toolItems.id, id));
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`❌ 错误: ${error.message}`, 500);
  }
});

export { tools as toolsRoutes };