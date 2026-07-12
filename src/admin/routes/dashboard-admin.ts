import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import { dashboardCards, dashboardLinks } from "@/db/schema";
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

const dashboardAdmin = new Hono<AdminAppEnv>();
dashboardAdmin.use("*", requireAuth);

// ============ 仪表盘管理首页（卡片 + 链接） ============
dashboardAdmin.get("/", async (c) => {
  const session = getAuthenticatedSession(c);
  const db = getDb(c.env.DB);

  const cards = await db.select().from(dashboardCards).orderBy(asc(dashboardCards.sortOrder));
  const links = await db.select().from(dashboardLinks).orderBy(asc(dashboardLinks.sortOrder));

  const cardsRows = cards.map(card => `
    <tr>
      <td>${card.icon || '—'}</td>
      <td>${escapeHtml(card.title)}</td>
      <td>${card.sizePreset}</td>
      <td>${card.isEnabled ? '✅' : '❌'}</td>
      <td>
        <a href="/api/admin/dashboard-admin/cards/${card.id}/edit" class="btn btn-sm">编辑</a>
        <form method="post" action="/api/admin/dashboard-admin/cards/${card.id}/delete" style="display:inline;">
          <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
          <button type="submit" class="btn btn-sm btn-danger">删除</button>
        </form>
      </td>
    </tr>
  `).join('');

  const linksRows = links.length > 0 ? links.map(link => `
    <tr>
      <td>${link.icon ? (link.icon.startsWith('http') ? `<img src="${escapeAttribute(link.icon)}" style="width:24px;height:24px;object-fit:contain;border-radius:4px;" />` : `<span style="font-size:1.2rem;">${escapeHtml(link.icon)}</span>`) : '—'}</td>
      <td><strong>${escapeHtml(link.title)}</strong></td>
      <td><a href="${escapeAttribute(link.url)}" target="_blank" style="color:var(--color-accent);">${escapeHtml(link.url)}</a></td>
      <td>${link.sortOrder}</td>
      <td>
        <a href="/api/admin/dashboard-links/${link.id}/edit" class="btn btn-sm">编辑</a>
        <form method="post" action="/api/admin/dashboard-links/${link.id}/delete" style="display:inline;">
          <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
          <button type="submit" class="btn btn-sm btn-danger">删除</button>
        </form>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="5" class="empty-state">暂无链接</td></tr>`;

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
      <h1 style="margin:0;">仪表盘管理</h1>
      <div style="display:flex; gap:0.5rem;">
        <a href="/api/admin/dashboard-admin/cards/new" class="btn btn-primary">新建卡片</a>
        <a href="/api/admin/dashboard-admin/layout/edit" class="btn">编辑布局</a>
        <a href="/api/admin/dashboard-links/new" class="btn">新建链接</a>
      </div>
    </div>

    <h2>卡片管理</h2>
    <div class="table-card">
      <table class="data-table">
        <thead><tr>
          <th>图标</th><th>标题</th><th>大小</th><th>状态</th><th>操作</th>
        </tr></thead>
        <tbody>
          ${cardsRows || `<tr><td colspan="5" class="empty-state">暂无卡片</td></tr>`}
        </tbody>
      </table>
    </div>

    <h2 style="margin-top:2rem;">链接管理</h2>
    <div class="table-card">
      <table class="data-table">
        <thead><tr>
          <th>图标</th><th>名称</th><th>地址</th><th>排序</th><th>操作</th>
        </tr></thead>
        <tbody>
          ${linksRows}
        </tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("仪表盘管理", content, { csrfToken: session.csrfToken }));
});

// ============ 新建卡片（简化版：无类型、无API） ============
dashboardAdmin.get("/cards/new", async (c) => {
  const session = getAuthenticatedSession(c);
  const content = `
    <h1>新建卡片</h1>
    <form method="post" action="/api/admin/dashboard-admin/cards" class="form">
      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
      <div class="form-group">
        <label for="title">卡片标题 *</label>
        <input type="text" id="title" name="title" class="form-input" required />
      </div>
      <div class="form-group">
        <label for="icon">图标（emoji 或 Iconify 名）</label>
        <input type="text" id="icon" name="icon" class="form-input" placeholder="🕐 或 mdi:clock" />
      </div>
      <div class="form-group">
        <label for="size_preset">大小预设</label>
        <select id="size_preset" name="size_preset" class="form-select">
          <option value="small">小 (1列)</option>
          <option value="medium">中 (2列)</option>
          <option value="large">大 (3列)</option>
          <option value="xlarge">超大 (4列)</option>
          <option value="custom">自定义</option>
        </select>
        <p class="form-help">预设大小对应网格列数（1-4列），选择"自定义"后可手动设置列数和行数。</p>
      </div>
      <div class="form-group" id="customSizeGroup" style="display:none;">
        <label>自定义大小</label>
        <div style="display:flex; gap:1rem;">
          <input type="number" name="width" placeholder="列数 (1-4)" class="form-input" style="width:100px;" min="1" max="4" />
          <input type="number" name="height" placeholder="行数 (1-4)" class="form-input" style="width:100px;" min="1" max="4" />
        </div>
        <p class="form-help">列数和行数均需在 1~4 之间。</p>
      </div>
      <div class="form-group">
        <label for="content_template">内容模板（HTML代码）</label>
        <textarea id="content_template" name="content_template" class="form-textarea" rows="10" placeholder="<div>自定义内容</div>"></textarea>
        <p class="form-help">支持 HTML + CSS，保存后前台刷新即可显示。可用变量：<code>{{data.title}}</code>、<code>{{data.icon}}</code></p>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">创建</button>
        <a href="/api/admin/dashboard-admin" class="btn">取消</a>
      </div>
    </form>
    <script>
      document.getElementById('size_preset').addEventListener('change', function() {
        document.getElementById('customSizeGroup').style.display = this.value === 'custom' ? 'block' : 'none';
      });
    </script>
  `;

  return c.html(adminLayout("新建卡片", content, { csrfToken: session.csrfToken }));
});

dashboardAdmin.post("/cards", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const title = getBodyText(body, "title").trim();
    const icon = getBodyText(body, "icon").trim() || null;
    const sizePreset = getBodyText(body, "size_preset") || "small";
    const width = Number.parseInt(getBodyText(body, "width")) || 1;
    const height = Number.parseInt(getBodyText(body, "height")) || 1;
    const contentTemplate = getBodyText(body, "content_template") || "";

    if (!title) return c.text("标题不能为空", 400);

    const cardKey = `custom_${Date.now()}`;
    const db = getDb(c.env.DB);
    await db.insert(dashboardCards).values({
      cardKey,
      title,
      icon,
      type: "custom",
      contentTemplate,
      sizePreset,
      width,
      height,
      isEnabled: 1,
    });
    return c.redirect("/api/admin/dashboard-admin");
  } catch (error) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ============ 编辑卡片 ============
dashboardAdmin.get("/cards/:id/edit", async (c) => {
  const session = getAuthenticatedSession(c);
  const id = Number.parseInt(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [card] = await db.select().from(dashboardCards).where(eq(dashboardCards.id, id));
  if (!card) return c.notFound();

  const content = `
    <h1>编辑卡片</h1>
    <form method="post" action="/api/admin/dashboard-admin/cards/${id}" class="form">
      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
      <input type="hidden" name="_method" value="put" />
      <div class="form-group">
        <label for="title">卡片标题 *</label>
        <input type="text" id="title" name="title" class="form-input" value="${escapeAttribute(card.title)}" required />
      </div>
      <div class="form-group">
        <label for="icon">图标</label>
        <input type="text" id="icon" name="icon" class="form-input" value="${escapeAttribute(card.icon || '')}" placeholder="🕐 或 mdi:clock" />
      </div>
      <div class="form-group">
        <label for="size_preset">大小预设</label>
        <select id="size_preset" name="size_preset" class="form-select">
          <option value="small" ${card.sizePreset === 'small' ? 'selected' : ''}>小 (1列)</option>
          <option value="medium" ${card.sizePreset === 'medium' ? 'selected' : ''}>中 (2列)</option>
          <option value="large" ${card.sizePreset === 'large' ? 'selected' : ''}>大 (3列)</option>
          <option value="xlarge" ${card.sizePreset === 'xlarge' ? 'selected' : ''}>超大 (4列)</option>
          <option value="custom" ${card.sizePreset === 'custom' ? 'selected' : ''}>自定义</option>
        </select>
        <p class="form-help">预设大小对应网格列数（1-4列），选择"自定义"后可手动设置列数和行数。</p>
      </div>
      <div class="form-group" id="customSizeGroup" style="${card.sizePreset === 'custom' ? 'display:block;' : 'display:none;'}">
        <label>自定义大小</label>
        <div style="display:flex; gap:1rem;">
          <input type="number" name="width" placeholder="列数 (1-4)" class="form-input" style="width:100px;" min="1" max="4" value="${card.width}" />
          <input type="number" name="height" placeholder="行数 (1-4)" class="form-input" style="width:100px;" min="1" max="4" value="${card.height}" />
        </div>
        <p class="form-help">列数和行数均需在 1~4 之间。</p>
      </div>
      <div class="form-group">
        <label for="content_template">内容模板（HTML代码）</label>
        <textarea id="content_template" name="content_template" class="form-textarea" rows="10">${escapeHtml(card.contentTemplate || '')}</textarea>
        <p class="form-help">支持 HTML + CSS，保存后前台刷新即可显示。可用变量：<code>{{data.title}}</code>、<code>{{data.icon}}</code></p>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">更新</button>
        <a href="/api/admin/dashboard-admin" class="btn">取消</a>
      </div>
    </form>
    <script>
      document.getElementById('size_preset').addEventListener('change', function() {
        document.getElementById('customSizeGroup').style.display = this.value === 'custom' ? 'block' : 'none';
      });
    </script>
  `;

  return c.html(adminLayout("编辑卡片", content, { csrfToken: session.csrfToken }));
});

dashboardAdmin.post("/cards/:id", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const title = getBodyText(body, "title").trim();
    const icon = getBodyText(body, "icon").trim() || null;
    const sizePreset = getBodyText(body, "size_preset") || "small";
    const width = Number.parseInt(getBodyText(body, "width")) || 1;
    const height = Number.parseInt(getBodyText(body, "height")) || 1;
    const contentTemplate = getBodyText(body, "content_template") || "";

    if (!title) return c.text("标题不能为空", 400);

    const db = getDb(c.env.DB);
    await db.update(dashboardCards)
      .set({ title, icon, contentTemplate, sizePreset, width, height, updatedAt: new Date().toISOString() })
      .where(eq(dashboardCards.id, id));
    return c.redirect("/api/admin/dashboard-admin");
  } catch (error) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

dashboardAdmin.post("/cards/:id/delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const db = getDb(c.env.DB);
    await db.delete(dashboardCards).where(eq(dashboardCards.id, id));
    return c.redirect("/api/admin/dashboard-admin");
  } catch (error) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ============ 编辑布局（增加取消按钮） ============
dashboardAdmin.get("/layout/edit", async (c) => {
  const session = getAuthenticatedSession(c);
  const db = getDb(c.env.DB);

  const [layout] = await db.select().from(dashboardLayouts).where(eq(dashboardLayouts.isDefault, 1));
  const layoutData = layout ? layout.layoutData : '[]';
  const cards = await db.select().from(dashboardCards).where(eq(dashboardCards.isEnabled, 1));

  const content = `
    <h1>编辑布局</h1>
    <p class="page-intro">拖拽卡片调整位置和大小，保存后自动生效。</p>

    <div id="layoutEditor">
      <div class="grid-stack" id="gridStack">
        ${cards.map(card => `
          <div class="grid-stack-item" data-gs-x="0" data-gs-y="0" data-gs-w="1" data-gs-h="1" data-card-id="${card.id}">
            <div class="grid-stack-item-content">
              <div class="card-header">
                <span class="card-icon">${card.icon || '📦'}</span>
                <span class="card-title">${escapeHtml(card.title)}</span>
              </div>
              <div class="card-preview">${card.type === 'system' ? '系统卡片' : '自定义卡片'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div style="margin-top:1rem; display:flex; gap:0.5rem;">
      <button id="saveLayoutBtn" class="btn btn-primary">保存布局</button>
      <a href="/api/admin/dashboard-admin" class="btn">取消</a>
    </div>

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack.min.css" />
    <style>
      .grid-stack-item-content {
        padding: 0.5rem;
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        height: 100%;
        overflow: hidden;
      }
      .grid-stack-item-content .card-header {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.2rem;
        margin-bottom: 0.3rem;
      }
      .grid-stack-item-content .card-preview {
        font-size: 0.7rem;
        color: var(--color-text-muted);
      }
      .grid-stack-item {
        transition: none;
      }
      .grid-stack-item:hover .grid-stack-item-content {
        border-color: var(--color-accent);
      }
    </style>

    <script src="https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack-all.min.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const grid = GridStack.init({
          column: 4,
          cellHeight: 100,
          margin: 8,
          resizable: true,
          draggable: true,
          alwaysShowResizeHandle: true,
        });

        const savedLayout = ${layoutData};
        if (savedLayout && savedLayout.length > 0) {
          grid.load(savedLayout);
        }

        document.getElementById('saveLayoutBtn').addEventListener('click', function() {
          const layout = grid.save();
          fetch('/api/admin/dashboard-admin/layout/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout, _csrf: '${escapeAttribute(session.csrfToken)}' })
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              alert('布局保存成功！');
            } else {
              alert('保存失败：' + data.error);
            }
          })
          .catch(err => {
            alert('保存失败：' + err.message);
          });
        });
      });
    </script>
  `;

  return c.html(adminLayout("编辑布局", content, { csrfToken: session.csrfToken }));
});

dashboardAdmin.post("/layout/save", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.json();
    if (body._csrf !== session.csrfToken) {
      return c.json({ success: false, error: "CSRF 校验失败" }, 403);
    }

    const db = getDb(c.env.DB);
    const layoutJson = JSON.stringify(body.layout);

    const [existing] = await db.select().from(dashboardLayouts).where(eq(dashboardLayouts.isDefault, 1));
    if (existing) {
      await db.update(dashboardLayouts)
        .set({ layoutData: layoutJson, updatedAt: new Date().toISOString() })
        .where(eq(dashboardLayouts.id, existing.id));
    } else {
      await db.insert(dashboardLayouts).values({
        name: "默认布局",
        layoutData: layoutJson,
        isDefault: 1,
      });
    }
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export { dashboardAdmin as dashboardAdminRoutes };