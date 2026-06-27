import { Hono } from "hono";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { toolCategories, toolItems } from "@/db/schema";
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
  const session = getAuthenticatedSession(c);
  const db = c.env.DB;

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

  const content = `
    <h1>工具箱管理</h1>
    <div class="page-actions">
      <a href="/api/admin/tools/categories/new" class="btn btn-primary">新建分类</a>
      <a href="/api/admin/tools/items/new" class="btn">新建工具</a>
    </div>
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>分类名称</th>
            <th>工具数量</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            categories.length > 0
              ? categories
                  .map(
                    (cat) => `
                <tr>
                  <td><a href="/api/admin/tools/categories/${cat.id}">${escapeHtml(cat.name)}</a></td>
                  <td>${cat.count}</td>
                  <td>
                    <a href="/api/admin/tools/categories/${cat.id}/edit" class="btn btn-sm">编辑</a>
                    <form method="post" action="/api/admin/tools/categories/${cat.id}/delete" style="display:inline;">
                      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
                      <button type="submit" class="btn btn-sm btn-danger" data-confirm-message="确认删除此分类及其所有工具吗？">删除</button>
                    </form>
                  </td>
                </tr>
              `
                  )
                  .join("")
              : `<tr><td colspan="3" class="empty-state">暂无分类，请先创建。</td></tr>`
          }
        </tbody>
      </table>
    </div>
    <h2>所有工具</h2>
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>工具名称</th>
            <th>分类</th>
            <th>描述</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            await (async () => {
              const items = await db
                .select({
                  id: toolItems.id,
                  name: toolItems.name,
                  description: toolItems.description,
                  categoryName: toolCategories.name,
                })
                .from(toolItems)
                .leftJoin(toolCategories, eq(toolItems.categoryId, toolCategories.id))
                .orderBy(asc(toolCategories.name), asc(toolItems.sortOrder), asc(toolItems.name));
              if (items.length === 0) {
                return `<tr><td colspan="4" class="empty-state">暂无工具，请添加。</td></tr>`;
              }
              return items
                .map(
                  (item) => `
                <tr>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.categoryName || "未分类")}</td>
                  <td>${escapeHtml(item.description || "")}</td>
                  <td>
                    <a href="/api/admin/tools/items/${item.id}/edit" class="btn btn-sm">编辑</a>
                    <form method="post" action="/api/admin/tools/items/${item.id}/delete" style="display:inline;">
                      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
                      <button type="submit" class="btn btn-sm btn-danger" data-confirm-message="确认删除此工具吗？">删除</button>
                    </form>
                  </td>
                </tr>
              `
                )
                .join("");
            })()
          }
        </tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("工具箱管理", content, { csrfToken: session.csrfToken }));
});

// ============ 分类管理 ============
tools.get("/categories/new", async (c) => {
  const session = getAuthenticatedSession(c);
  const content = `
    <h1>新建分类</h1>
    <form method="post" action="/api/admin/tools/categories" class="form">
      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
      <div class="form-group">
        <label for="name">分类名称</label>
        <input type="text" id="name" name="name" class="form-input" required />
      </div>
      <div class="form-group">
        <label for="sortOrder">排序权重（数字越小越靠前）</label>
        <input type="number" id="sortOrder" name="sortOrder" class="form-input" value="0" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">创建</button>
        <a href="/api/admin/tools" class="btn">取消</a>
      </div>
    </form>
  `;
  return c.html(adminLayout("新建分类", content, { csrfToken: session.csrfToken }));
});

tools.post("/categories", async (c) => {
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
  const db = c.env.DB;
  await db.insert(toolCategories).values({ name, sortOrder });
  return c.redirect("/api/admin/tools");
});

tools.get("/categories/:id/edit", async (c) => {
  const session = getAuthenticatedSession(c);
  const id = Number.parseInt(c.req.param("id"));
  const db = c.env.DB;
  const [category] = await db
    .select()
    .from(toolCategories)
    .where(eq(toolCategories.id, id));
  if (!category) return c.notFound();
  const content = `
    <h1>编辑分类</h1>
    <form method="post" action="/api/admin/tools/categories/${id}" class="form">
      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
      <input type="hidden" name="_method" value="put" />
      <div class="form-group">
        <label for="name">分类名称</label>
        <input type="text" id="name" name="name" class="form-input" value="${escapeAttribute(category.name)}" required />
      </div>
      <div class="form-group">
        <label for="sortOrder">排序权重</label>
        <input type="number" id="sortOrder" name="sortOrder" class="form-input" value="${category.sortOrder}" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">更新</button>
        <a href="/api/admin/tools" class="btn">取消</a>
      </div>
    </form>
  `;
  return c.html(adminLayout("编辑分类", content, { csrfToken: session.csrfToken }));
});

tools.post("/categories/:id", async (c) => {
  const session = getAuthenticatedSession(c);
  const id = Number.parseInt(c.req.param("id"));
  const body = await c.req.parseBody();
  if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
    return c.text("CSRF 校验失败", 403);
  }
  const name = getBodyText(body, "name").trim();
  const sortOrder = Number.parseInt(getBodyText(body, "sortOrder")) || 0;
  if (!name) return c.text("分类名称不能为空", 400);
  const db = c.env.DB;
  await db
    .update(toolCategories)
    .set({ name, sortOrder, updatedAt: new Date().toISOString() })
    .where(eq(toolCategories.id, id));
  return c.redirect("/api/admin/tools");
});

tools.post("/categories/:id/delete", async (c) => {
  const session = getAuthenticatedSession(c);
  const id = Number.parseInt(c.req.param("id"));
  const body = await c.req.parseBody();
  if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
    return c.text("CSRF 校验失败", 403);
  }
  const db = c.env.DB;
  await db.delete(toolCategories).where(eq(toolCategories.id, id));
  return c.redirect("/api/admin/tools");
});

// ============ 工具条目管理 ============
tools.get("/items/new", async (c) => {
  const session = getAuthenticatedSession(c);
  const db = c.env.DB;
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
  const content = `
    <h1>新建工具</h1>
    <form method="post" action="/api/admin/tools/items" class="form">
      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
      <div class="form-group">
        <label for="name">工具名称</label>
        <input type="text" id="name" name="name" class="form-input" required />
      </div>
      <div class="form-group">
        <label for="description">描述</label>
        <input type="text" id="description" name="description" class="form-input" />
      </div>
      <div class="form-group">
        <label for="url">URL</label>
        <input type="url" id="url" name="url" class="form-input" required />
      </div>
      <div class="form-group">
        <label for="icon">图标 URL</label>
        <input type="url" id="icon" name="icon" class="form-input" placeholder="https://example.com/icon.png" />
      </div>
      <div class="form-group">
        <label for="categoryId">所属分类</label>
        <select id="categoryId" name="categoryId" class="form-select" required>
          <option value="">请选择</option>
          ${categoryOptions}
        </select>
      </div>
      <div class="form-group">
        <label for="sortOrder">排序权重</label>
        <input type="number" id="sortOrder" name="sortOrder" class="form-input" value="0" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">创建</button>
        <a href="/api/admin/tools" class="btn">取消</a>
      </div>
    </form>
  `;
  return c.html(adminLayout("新建工具", content, { csrfToken: session.csrfToken }));
});

tools.post("/items", async (c) => {
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
  const db = c.env.DB;
  await db.insert(toolItems).values({
    name,
    description,
    url,
    icon: icon || null,
    categoryId,
    sortOrder,
  });
  return c.redirect("/api/admin/tools");
});

tools.get("/items/:id/edit", async (c) => {
  const session = getAuthenticatedSession(c);
  const id = Number.parseInt(c.req.param("id"));
  const db = c.env.DB;
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
  const content = `
    <h1>编辑工具</h1>
    <form method="post" action="/api/admin/tools/items/${id}" class="form">
      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
      <input type="hidden" name="_method" value="put" />
      <div class="form-group">
        <label for="name">工具名称</label>
        <input type="text" id="name" name="name" class="form-input" value="${escapeAttribute(item.name)}" required />
      </div>
      <div class="form-group">
        <label for="description">描述</label>
        <input type="text" id="description" name="description" class="form-input" value="${escapeAttribute(item.description || "")}" />
      </div>
      <div class="form-group">
        <label for="url">URL</label>
        <input type="url" id="url" name="url" class="form-input" value="${escapeAttribute(item.url)}" required />
      </div>
      <div class="form-group">
        <label for="icon">图标 URL</label>
        <input type="url" id="icon" name="icon" class="form-input" value="${escapeAttribute(item.icon || "")}" />
      </div>
      <div class="form-group">
        <label for="categoryId">所属分类</label>
        <select id="categoryId" name="categoryId" class="form-select" required>
          ${categoryOptions}
        </select>
      </div>
      <div class="form-group">
        <label for="sortOrder">排序权重</label>
        <input type="number" id="sortOrder" name="sortOrder" class="form-input" value="${item.sortOrder}" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">更新</button>
        <a href="/api/admin/tools" class="btn">取消</a>
      </div>
    </form>
  `;
  return c.html(adminLayout("编辑工具", content, { csrfToken: session.csrfToken }));
});

tools.post("/items/:id", async (c) => {
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
  const db = c.env.DB;
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
});

tools.post("/items/:id/delete", async (c) => {
  const session = getAuthenticatedSession(c);
  const id = Number.parseInt(c.req.param("id"));
  const body = await c.req.parseBody();
  if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
    return c.text("CSRF 校验失败", 403);
  }
  const db = c.env.DB;
  await db.delete(toolItems).where(eq(toolItems.id, id));
  return c.redirect("/api/admin/tools");
});

export { tools as toolsRoutes };