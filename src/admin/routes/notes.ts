import { Hono } from "hono";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { notes } from "@/db/schema";
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

const notesRoutes = new Hono<AdminAppEnv>();
notesRoutes.use("*", requireAuth);

// ===== 便签管理首页 =====
notesRoutes.get("/", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const db = getDb(c.env.DB);
    const statusFilter = c.req.query("status") || "all";

    let query = db.select().from(notes);
    if (statusFilter !== "all") {
      query = query.where(eq(notes.status, statusFilter));
    }
    const allNotes = await query.orderBy(desc(notes.createdAt));

    const stats = await db
      .select({
        total: sql<number>`count(*)`.as("total"),
        pending: sql<number>`count(case when status = 'pending' then 1 end)`.as("pending"),
        approved: sql<number>`count(case when status = 'approved' then 1 end)`.as("approved"),
        rejected: sql<number>`count(case when status = 'rejected' then 1 end)`.as("rejected"),
      })
      .from(notes);

    const stat = stats[0] || { total: 0, pending: 0, approved: 0, rejected: 0 };

    const statusOptions = [
      { value: "all", label: "全部" },
      { value: "pending", label: `待审核 (${stat.pending})` },
      { value: "approved", label: `已通过 (${stat.approved})` },
      { value: "rejected", label: `已拒绝 (${stat.rejected})` },
    ];

    const rowsHtml =
      allNotes.length === 0
        ? `<tr><td colspan="7" class="empty-state">暂无便签</td></tr>`
        : allNotes
            .map(
              (note) => `
                <tr>
                  <td><input type="checkbox" class="note-checkbox" name="ids" value="${note.id}" /></td>
                  <td>${escapeHtml(note.content.substring(0, 50))}${note.content.length > 50 ? "..." : ""}</td>
                  <td>${escapeHtml(note.visitorIp || "匿名")}</td>
                  <td>
                    <span class="badge ${note.status === "approved" ? "badge-published" : note.status === "pending" ? "badge-draft" : "badge-danger"}">
                      ${note.status === "approved" ? "已通过" : note.status === "pending" ? "待审核" : "已拒绝"}
                    </span>
                  </td>
                  <td>${new Date(note.createdAt).toLocaleString()}</td>
                  <td>
                    ${note.status === "pending" ? `
                      <form method="post" action="/api/admin/notes/${note.id}/approve" style="display:inline;">
                        <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
                        <button type="submit" class="btn btn-sm btn-primary">通过</button>
                      </form>
                      <form method="post" action="/api/admin/notes/${note.id}/reject" style="display:inline;">
                        <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
                        <button type="submit" class="btn btn-sm btn-danger">拒绝</button>
                      </form>
                    ` : `
                      <form method="post" action="/api/admin/notes/${note.id}/delete" style="display:inline;">
                        <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
                        <button type="submit" class="btn btn-sm btn-danger">删除</button>
                      </form>
                    `}
                  </td>
                </tr>
              `
            )
            .join("");

    const content = `
      <h1>便签墙管理</h1>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${stat.total}</div><div class="stat-label">总便签</div></div>
        <div class="stat-card"><div class="stat-value">${stat.pending}</div><div class="stat-label">待审核</div></div>
        <div class="stat-card"><div class="stat-value">${stat.approved}</div><div class="stat-label">已通过</div></div>
        <div class="stat-card"><div class="stat-value">${stat.rejected}</div><div class="stat-label">已拒绝</div></div>
      </div>

      <div class="table-actions" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
        <div style="display: flex; gap: 0.5rem;">
          ${statusOptions.map(opt =>
            `<a href="/api/admin/notes?status=${opt.value}" class="btn btn-sm ${statusFilter === opt.value ? "btn-primary" : ""}">${opt.label}</a>`
          ).join("")}
        </div>
        <form method="post" action="/api/admin/notes/batch-delete" style="display: inline-flex; gap: 0.3rem; align-items: center;">
          <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
          <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('确认删除选中的便签吗？')">批量删除</button>
        </form>
      </div>

      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="selectAll" /></th>
              <th>内容</th>
              <th>IP</th>
              <th>状态</th>
              <th>发布时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <script>
        document.getElementById('selectAll')?.addEventListener('change', function(e) {
          document.querySelectorAll('.note-checkbox').forEach(cb => cb.checked = e.target.checked);
        });
      </script>
    `;

    return c.html(adminLayout("便签墙管理", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ===== 审批通过 =====
notesRoutes.post("/:id/approve", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) return c.text("CSRF 校验失败", 403);
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB);
    await db.update(notes).set({ status: "approved", updatedAt: new Date().toISOString() }).where(eq(notes.id, id));
    return c.redirect("/api/admin/notes");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ===== 拒绝 =====
notesRoutes.post("/:id/reject", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) return c.text("CSRF 校验失败", 403);
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB);
    await db.update(notes).set({ status: "rejected", updatedAt: new Date().toISOString() }).where(eq(notes.id, id));
    return c.redirect("/api/admin/notes");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ===== 删除单个 =====
notesRoutes.post("/:id/delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) return c.text("CSRF 校验失败", 403);
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB);
    await db.delete(notes).where(eq(notes.id, id));
    return c.redirect("/api/admin/notes");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ===== 批量删除（仅保留） =====
notesRoutes.post("/batch-delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) return c.text("CSRF 校验失败", 403);
    const ids = body["ids"] || [];
    const idList = Array.isArray(ids) ? ids.map(Number).filter(n => !isNaN(n)) : [];
    if (idList.length === 0) return c.text("请选择要删除的便签", 400);
    const db = getDb(c.env.DB);
    await db.delete(notes).where(sql`id IN (${idList.join(",")})`);
    return c.redirect("/api/admin/notes");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

export { notesRoutes as notesRoutes };