import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import { dashboardLinks } from "@/db/schema";
import { getDb } from "@/lib/db";
import { escapeAttribute, escapeHtml } from "@/lib/security";
import {
  type AdminAppEnv,
  assertCsrfToken,
  getAuthenticatedSession,
  getBodyText,
  requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";

const linksRoutes = new Hono<AdminAppEnv>();
linksRoutes.use("*", requireAuth);

// ============ Links 管理首页 ============
linksRoutes.get("/", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const db = getDb(c.env.DB);
    const links = await db
      .select()
      .from(dashboardLinks)
      .orderBy(asc(dashboardLinks.sortOrder));

    const rowsHtml =
      links.length === 0
        ? `<tr><td colspan="5" class="empty-state">暂无链接</td></tr>`
        : links
            .map(
              (link) => `
                <tr>
                  <td>
                    ${link.icon ? (
                      link.icon.startsWith('http') ? (
                        `<img src="${escapeAttribute(link.icon)}" style="width:24px;height:24px;object-fit:contain;border-radius:4px;" />`
                      ) : (
                        `<span style="font-size:1.2rem;">${escapeHtml(link.icon)}</span>`
                      )
                    ) : '—'}
                  </td>
                  <td><strong>${escapeHtml(link.title)}</strong></td>
                  <td><a href="${escapeAttribute(link.url)}" target="_blank" style="color:var(--color-accent);">${escapeHtml(link.url)}</a></td>
                  <td>${link.sortOrder}</td>
                  <td>
                    <a href="/api/admin/dashboard-links/${link.id}/edit" class="btn btn-sm">编辑</a>
                    <form method="post" action="/api/admin/dashboard-links/${link.id}/delete" style="display:inline;">
                      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
                      <button type="submit" class="btn btn-sm btn-danger" data-confirm-message="确认删除此链接吗？">删除</button>
                    </form>
                  </td>
                </tr>
              `
            )
            .join("");

    const content = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
        <h1 style="margin:0;">仪表盘链接管理</h1>
        <a href="/api/admin/dashboard-links/new" class="btn btn-primary">新建链接</a>
      </div>
      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:60px;">图标</th>
              <th>名称</th>
              <th>地址</th>
              <th style="width:80px;">排序</th>
              <th style="width:160px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    return c.html(adminLayout("仪表盘链接", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ============ 新建链接 ============
linksRoutes.get("/new", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const content = `
      <h1>新建链接</h1>
      <form method="post" action="/api/admin/dashboard-links" class="form">
        <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
        <div class="form-group">
          <label for="title">卡片名称 *</label>
          <input type="text" id="title" name="title" class="form-input" required placeholder="例如：北京时间" />
        </div>
        <div class="form-group">
          <label for="url">跳转地址 *</label>
          <input type="text" id="url" name="url" class="form-input" required placeholder="/dashboard 或 https://example.com" />
        </div>
        <div class="form-group">
          <label for="icon">图标</label>
          <input type="text" id="icon" name="icon" class="form-input" placeholder="emoji（如 🔗）或图片URL 或 Iconify图标名（如 mdi:home）" />
          <p class="form-help">支持三种格式：1️⃣ emoji（如 🔗） 2️⃣ 图片URL 3️⃣ Iconify图标名（如 mdi:home，需加载对应图标库）</p>
        </div>
        <div class="form-group">
          <label for="sortOrder">排序权重（数字越小越靠前）</label>
          <input type="number" id="sortOrder" name="sortOrder" class="form-input" value="0" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">创建</button>
          <a href="/api/admin/dashboard-links" class="btn">取消</a>
        </div>
      </form>
    `;
    return c.html(adminLayout("新建链接", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

linksRoutes.post("/", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const title = getBodyText(body, "title").trim();
    const url = getBodyText(body, "url").trim();
    const icon = getBodyText(body, "icon").trim() || null;
    const sortOrder = Number.parseInt(getBodyText(body, "sortOrder")) || 0;
    if (!title || !url) {
      return c.text("名称和地址为必填项", 400);
    }
    const db = getDb(c.env.DB);
    await db.insert(dashboardLinks).values({ title, url, icon, sortOrder });
    return c.redirect("/api/admin/dashboard-links");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ============ 编辑链接 ============
linksRoutes.get("/:id/edit", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB);
    const [link] = await db
      .select()
      .from(dashboardLinks)
      .where(eq(dashboardLinks.id, id));
    if (!link) return c.notFound();

    const content = `
      <h1>编辑链接</h1>
      <form method="post" action="/api/admin/dashboard-links/${id}" class="form">
        <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
        <input type="hidden" name="_method" value="put" />
        <div class="form-group">
          <label for="title">卡片名称 *</label>
          <input type="text" id="title" name="title" class="form-input" value="${escapeAttribute(link.title)}" required />
        </div>
        <div class="form-group">
          <label for="url">跳转地址 *</label>
          <input type="text" id="url" name="url" class="form-input" value="${escapeAttribute(link.url)}" required />
        </div>
        <div class="form-group">
          <label for="icon">图标</label>
          <input type="text" id="icon" name="icon" class="form-input" value="${escapeAttribute(link.icon || '')}" />
          <p class="form-help">当前图标：${link.icon || '无'}</p>
        </div>
        <div class="form-group">
          <label for="sortOrder">排序权重</label>
          <input type="number" id="sortOrder" name="sortOrder" class="form-input" value="${link.sortOrder}" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">更新</button>
          <a href="/api/admin/dashboard-links" class="btn">取消</a>
        </div>
      </form>
    `;
    return c.html(adminLayout("编辑链接", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

linksRoutes.post("/:id", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const title = getBodyText(body, "title").trim();
    const url = getBodyText(body, "url").trim();
    const icon = getBodyText(body, "icon").trim() || null;
    const sortOrder = Number.parseInt(getBodyText(body, "sortOrder")) || 0;
    if (!title || !url) {
      return c.text("名称和地址为必填项", 400);
    }
    const db = getDb(c.env.DB);
    await db
      .update(dashboardLinks)
      .set({ title, url, icon, sortOrder, updatedAt: new Date().toISOString() })
      .where(eq(dashboardLinks.id, id));
    return c.redirect("/api/admin/dashboard-links");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ============ 删除链接 ============
linksRoutes.post("/:id/delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const db = getDb(c.env.DB);
    await db.delete(dashboardLinks).where(eq(dashboardLinks.id, id));
    return c.redirect("/api/admin/dashboard-links");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

export { linksRoutes as dashboardLinksRoutes };