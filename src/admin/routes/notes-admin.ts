import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
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

const notesAdmin = new Hono<AdminAppEnv>();
notesAdmin.use("*", requireAuth);

// ===== 主页面 =====
notesAdmin.get("/", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const db = getDb(c.env.DB);
    
    // 统计数据
    const stats = await db
      .select({
        total: sql<number>`count(*)`.as("total"),
        today: sql<number>`count(case when date(createdAt) = date('now') then 1 end)`.as("today"),
        approved: sql<number>`count(case when status = 'approved' then 1 end)`.as("approved"),
        pending: sql<number>`count(case when status = 'pending' then 1 end)`.as("pending"),
      })
      .from(notes);

    const stat = stats[0] || { total: 0, today: 0, approved: 0, pending: 0 };

    // 获取所有便签（按时间降序）
    const allNotes = await db
      .select()
      .from(notes)
      .orderBy(desc(notes.createdAt));

    const rowsHtml = allNotes.length === 0
      ? `<tr><td colspan="6" class="empty-state">暂无便签</td></tr>`
      : allNotes.map(note => `
          <tr>
            <td><input type="checkbox" class="note-checkbox" name="ids" value="${note.id}" /></td>
            <td>${escapeHtml(note.content)}</td>
            <td>${escapeHtml(note.colorTheme || '默认')}</td>
            <td>
              <span class="badge ${note.status === 'approved' ? 'badge-published' : note.status === 'pending' ? 'badge-draft' : 'badge-danger'}">
                ${note.status === 'approved' ? '已通过' : note.status === 'pending' ? '待审核' : '已拒绝'}
              </span>
            </td>
            <td>${new Date(note.createdAt).toLocaleString()}</td>
            <td>
              <form method="post" action="/api/admin/notes-admin/${note.id}/delete" style="display:inline;">
                <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
                <button type="submit" class="btn btn-sm btn-danger">删除</button>
              </form>
            </td>
          </tr>
      `).join('');

    const content = `
      <h1>便签管理</h1>

      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${stat.total}</div><div class="stat-label">总便签</div></div>
        <div class="stat-card"><div class="stat-value">${stat.today}</div><div class="stat-label">今日新增</div></div>
        <div class="stat-card"><div class="stat-value">${stat.approved}</div><div class="stat-label">已通过</div></div>
        <div class="stat-card"><div class="stat-value">${stat.pending}</div><div class="stat-label">待审核</div></div>
      </div>

      <!-- 操作栏 -->
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem; align-items:center;">
        <form method="post" action="/api/admin/notes-admin/add" style="display:flex; gap:0.5rem; align-items:center;">
          <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
          <input type="text" name="content" placeholder="输入便签内容..." maxlength="30" class="form-input" style="width:200px;" required />
          <select name="colorTheme" class="form-select" style="width:100px;">
            <option value="yellow">黄色</option>
            <option value="blue">蓝色</option>
            <option value="green">绿色</option>
            <option value="pink">粉色</option>
            <option value="purple">紫色</option>
            <option value="orange">橙色</option>
          </select>
          <button type="submit" class="btn btn-primary">添加便签</button>
        </form>
        <form method="post" action="/api/admin/notes-admin/batch-delete" style="display:inline-flex; gap:0.3rem; align-items:center;">
          <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
          <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('确认删除选中的便签吗？')">批量删除</button>
        </form>
      </div>

      <!-- 表格 -->
      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="selectAll" /></th>
              <th>内容</th>
              <th>颜色</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>

      <script>
        document.getElementById('selectAll')?.addEventListener('change', function(e) {
          document.querySelectorAll('.note-checkbox').forEach(cb => cb.checked = e.target.checked);
        });
      </script>
    `;

    return c.html(adminLayout("便签管理", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    console.error("便签管理页面错误:", error);
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ===== 添加便签（管理员） =====
notesAdmin.post("/add", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const content = getBodyText(body, "content").trim();
    const colorTheme = getBodyText(body, "colorTheme") || "yellow";
    if (!content) return c.text("内容不能为空", 400);
    if (content.length > 30) return c.text("内容不能超过30个字", 400);

    const db = getDb(c.env.DB);
    await db.insert(notes).values({
      content,
      colorTheme,
      positionLeft: Math.floor(Math.random() * 70) + 5,
      positionTop: Math.floor(Math.random() * 70) + 5,
      rotation: Math.floor(Math.random() * 20) - 10,
      status: "approved",
      visitorIp: "admin",
    });
    return c.redirect("/api/admin/notes-admin");
  } catch (error: any) {
    console.error("添加便签错误:", error);
    return c.text(`添加失败: ${error.message}`, 500);
  }
});

// ===== 批量删除 =====
notesAdmin.post("/batch-delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const ids = body["ids"] || [];
    const idList = Array.isArray(ids) ? ids.map(Number).filter(n => !isNaN(n)) : [];
    if (idList.length === 0) return c.text("请选择要删除的便签", 400);
    const db = getDb(c.env.DB);
    // 使用 inArray 替代 sql 模板，更安全
    for (const id of idList) {
      await db.delete(notes).where(eq(notes.id, id));
    }
    return c.redirect("/api/admin/notes-admin");
  } catch (error: any) {
    console.error("批量删除错误:", error);
    return c.text(`删除失败: ${error.message}`, 500);
  }
});

// ===== 单条删除 =====
notesAdmin.post("/:id/delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB);
    await db.delete(notes).where(eq(notes.id, id));
    return c.redirect("/api/admin/notes-admin");
  } catch (error: any) {
    console.error("删除便签错误:", error);
    return c.text(`删除失败: ${error.message}`, 500);
  }
});

export { notesAdmin as notesAdminRoutes };