import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import { dashboardCards, dashboardLayouts, apiProviders } from "@/db/schema";
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

// ============ 仪表盘管理首页 ============
dashboardAdmin.get("/", async (c) => {
  const session = getAuthenticatedSession(c);
  const db = getDb(c.env.DB);

  const cards = await db.select().from(dashboardCards).orderBy(asc(dashboardCards.sortOrder));
  const layouts = await db.select().from(dashboardLayouts).orderBy(asc(dashboardLayouts.name));
  const providers = await db.select().from(apiProviders);

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
      <h1 style="margin:0;">仪表盘管理</h1>
      <div style="display:flex; gap:0.5rem;">
        <a href="/api/admin/dashboard-admin/cards/new" class="btn btn-primary">新建卡片</a>
        <a href="/api/admin/dashboard-admin/layout/edit" class="btn">编辑布局</a>
        <a href="/api/admin/dashboard-admin/providers" class="btn">API管理</a>
      </div>
    </div>

    <h2>卡片管理</h2>
    <div class="table-card">
      <table class="data-table">
        <thead><tr>
          <th>图标</th><th>标题</th><th>类型</th><th>大小</th><th>状态</th><th>操作</th>
        </tr></thead>
        <tbody>
          ${cards.map(card => `
            <tr>
              <td>${card.icon || '—'}</td>
              <td>${escapeHtml(card.title)}</td>
              <td><span class="badge ${card.type === 'system' ? 'badge-published' : 'badge-draft'}">${card.type === 'system' ? '系统' : '自定义'}</span></td>
              <td>${card.sizePreset}</td>
              <td>${card.isEnabled ? '✅' : '❌'}</td>
              <td>
                <a href="/api/admin/dashboard-admin/cards/${card.id}/edit" class="btn btn-sm">编辑</a>
                ${card.type !== 'system' ? `
                  <form method="post" action="/api/admin/dashboard-admin/cards/${card.id}/delete" style="display:inline;">
                    <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
                    <button type="submit" class="btn btn-sm btn-danger">删除</button>
                  </form>
                ` : '<span style="color:var(--text-muted);font-size:0.7rem;">系统不可删</span>'}
              </td>
            </tr>
          `).join('')}
          ${cards.length === 0 ? `<tr><td colspan="6" class="empty-state">暂无卡片</td></tr>` : ''}
        </tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("仪表盘管理", content, { csrfToken: session.csrfToken }));
});

// ============ 新建卡片 ============
dashboardAdmin.get("/cards/new", async (c) => {
  const session = getAuthenticatedSession(c);
  const db = getDb(c.env.DB);
  const providers = await db.select().from(apiProviders);

  const providerOptions = providers.map(p =>
    `<option value="${p.id}">${escapeHtml(p.name)}</option>`
  ).join('');

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
        <label for="type">卡片类型</label>
        <select id="type" name="type" class="form-select">
          <option value="custom">自定义</option>
          <option value="system">系统（保留现有卡片）</option>
        </select>
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
      </div>
      <div class="form-group" id="customSizeGroup" style="display:none;">
        <label>自定义大小</label>
        <div style="display:flex; gap:1rem;">
          <input type="number" name="width" placeholder="列数 (1-4)" class="form-input" style="width:100px;" />
          <input type="number" name="height" placeholder="行数 (1-4)" class="form-input" style="width:100px;" />
        </div>
      </div>
      <div class="form-group">
        <label for="content_template">内容模板（HTML代码）</label>
        <textarea id="content_template" name="content_template" class="form-textarea" rows="10" placeholder="<div>自定义内容，可用 {{data.xxx}} 注入数据</div>"></textarea>
        <p class="form-help">支持 HTML + CSS + 模板变量。可用变量：<code>{{data.title}}</code>、<code>{{data.value}}</code>、<code>{{apiResponse}}</code></p>
      </div>
      <div class="form-group">
        <label for="api_provider_id">关联API提供商（可选）</label>
        <select id="api_provider_id" name="api_provider_id" class="form-select">
          <option value="">无</option>
          ${providerOptions}
        </select>
      </div>
      <div class="form-group">
        <label for="api_endpoint">自定义API端点（可选）</label>
        <input type="text" id="api_endpoint" name="api_endpoint" class="form-input" placeholder="https://api.example.com/data" />
      </div>
      <div class="form-group">
        <label for="refresh_interval">刷新间隔（秒，0=不刷新）</label>
        <input type="number" id="refresh_interval" name="refresh_interval" class="form-input" value="0" />
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

// ============ 保存卡片 ============
dashboardAdmin.post("/cards", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const title = getBodyText(body, "title").trim();
    const icon = getBodyText(body, "icon").trim() || null;
    const type = getBodyText(body, "type") || "custom";
    const sizePreset = getBodyText(body, "size_preset") || "small";
    const width = Number.parseInt(getBodyText(body, "width")) || 1;
    const height = Number.parseInt(getBodyText(body, "height")) || 1;
    const contentTemplate = getBodyText(body, "content_template") || "";
    const apiProviderId = Number.parseInt(getBodyText(body, "api_provider_id")) || null;
    const apiEndpoint = getBodyText(body, "api_endpoint") || null;
    const refreshInterval = Number.parseInt(getBodyText(body, "refresh_interval")) || 0;

    if (!title) return c.text("标题不能为空", 400);

    const cardKey = `custom_${Date.now()}`;
    const db = getDb(c.env.DB);
    await db.insert(dashboardCards).values({
      cardKey,
      title,
      icon,
      type,
      contentTemplate,
      sizePreset,
      width,
      height,
      apiProviderId,
      apiEndpoint,
      refreshInterval,
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

  const providers = await db.select().from(apiProviders);
  const providerOptions = providers.map(p =>
    `<option value="${p.id}" ${p.id === card.apiProviderId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');

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
        <label for="type">卡片类型</label>
        <select id="type" name="type" class="form-select" disabled>
          <option value="system" ${card.type === 'system' ? 'selected' : ''}>系统</option>
          <option value="custom" ${card.type === 'custom' ? 'selected' : ''}>自定义</option>
        </select>
        <input type="hidden" name="type" value="${card.type}" />
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
      </div>
      <div class="form-group" id="customSizeGroup" style="${card.sizePreset === 'custom' ? 'display:block;' : 'display:none;'}">
        <label>自定义大小</label>
        <div style="display:flex; gap:1rem;">
          <input type="number" name="width" placeholder="列数 (1-4)" class="form-input" style="width:100px;" value="${card.width}" />
          <input type="number" name="height" placeholder="行数 (1-4)" class="form-input" style="width:100px;" value="${card.height}" />
        </div>
      </div>
      <div class="form-group">
        <label for="content_template">内容模板（HTML代码）</label>
        <textarea id="content_template" name="content_template" class="form-textarea" rows="10">${escapeHtml(card.contentTemplate || '')}</textarea>
        <p class="form-help">支持 HTML + CSS + 模板变量。可用变量：<code>{{data.title}}</code>、<code>{{data.value}}</code>、<code>{{apiResponse}}</code></p>
      </div>
      <div class="form-group">
        <label for="api_provider_id">关联API提供商</label>
        <select id="api_provider_id" name="api_provider_id" class="form-select">
          <option value="">无</option>
          ${providerOptions}
        </select>
      </div>
      <div class="form-group">
        <label for="api_endpoint">自定义API端点</label>
        <input type="text" id="api_endpoint" name="api_endpoint" class="form-input" value="${escapeAttribute(card.apiEndpoint || '')}" placeholder="https://api.example.com/data" />
      </div>
      <div class="form-group">
        <label for="refresh_interval">刷新间隔（秒，0=不刷新）</label>
        <input type="number" id="refresh_interval" name="refresh_interval" class="form-input" value="${card.refreshInterval}" />
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
    const type = getBodyText(body, "type") || "custom";
    const sizePreset = getBodyText(body, "size_preset") || "small";
    const width = Number.parseInt(getBodyText(body, "width")) || 1;
    const height = Number.parseInt(getBodyText(body, "height")) || 1;
    const contentTemplate = getBodyText(body, "content_template") || "";
    const apiProviderId = Number.parseInt(getBodyText(body, "api_provider_id")) || null;
    const apiEndpoint = getBodyText(body, "api_endpoint") || null;
    const refreshInterval = Number.parseInt(getBodyText(body, "refresh_interval")) || 0;

    if (!title) return c.text("标题不能为空", 400);

    const db = getDb(c.env.DB);
    await db.update(dashboardCards)
      .set({ title, icon, type, contentTemplate, sizePreset, width, height, apiProviderId, apiEndpoint, refreshInterval, updatedAt: new Date().toISOString() })
      .where(eq(dashboardCards.id, id));
    return c.redirect("/api/admin/dashboard-admin");
  } catch (error) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ============ 删除卡片（仅自定义） ============
dashboardAdmin.post("/cards/:id/delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
      return c.text("CSRF 校验失败", 403);
    }
    const db = getDb(c.env.DB);
    const [card] = await db.select().from(dashboardCards).where(eq(dashboardCards.id, id));
    if (card.type === 'system') {
      return c.text("系统卡片不能删除", 400);
    }
    await db.delete(dashboardCards).where(eq(dashboardCards.id, id));
    return c.redirect("/api/admin/dashboard-admin");
  } catch (error) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ============ 编辑布局 ============
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
      <a href="/api/admin/dashboard-admin" class="btn">返回</a>
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

// ============ 保存布局 ====== ======
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

// ============ API管理 ============
dashboardAdmin.get("/providers", async (c) => {
  const session = getAuthenticatedSession(c);
  const db = getDb(c.env.DB);
  const providers = await db.select().from(apiProviders).orderBy(asc(apiProviders.name));

  const rows = providers.map(p => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.baseUrl)}</td>
      <td>${p.authType}</td>
      <td>${p.apiKey ? '已设置' : '未设置'}</td>
      <td>
        <a href="/api/admin/dashboard-admin/providers/${p.id}/edit" class="btn btn-sm">编辑</a>
        <form method="post" action="/api/admin/dashboard-admin/providers/${p.id}/delete" style="display:inline;">
          <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
          <button type="submit" class="btn btn-sm btn-danger">删除</button>
        </form>
      </td>
    </tr>
  `).join('');

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
      <h1 style="margin:0;">API提供商管理</h1>
      <a href="/api/admin/dashboard-admin/providers/new" class="btn btn-primary">新建提供商</a>
    </div>
    <div class="table-card">
      <table class="data-table">
        <thead><tr><th>名称</th><th>基础URL</th><th>认证方式</th><th>API Key</th><th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty-state">暂无提供商</td></tr>'}</tbody>
      </table>
    </div>
  `;
  return c.html(adminLayout("API管理", content, { csrfToken: session.csrfToken }));
});

dashboardAdmin.get("/providers/new", async (c) => {
  const session = getAuthenticatedSession(c);
  const content = `
    <h1>新建API提供商</h1>
    <form method="post" action="/api/admin/dashboard-admin/providers" class="form">
      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
      <div class="form-group">
        <label for="name">名称 *</label>
        <input type="text" id="name" name="name" class="form-input" required />
      </div>
      <div class="form-group">
        <label for="base_url">基础URL *</label>
        <input type="text" id="base_url" name="base_url" class="form-input" required placeholder="https://api.example.com/v1" />
      </div>
      <div class="form-group">
        <label for="auth_type">认证方式</label>
        <select id="auth_type" name="auth_type" class="form-select">
          <option value="bearer">Bearer Token</option>
          <option value="api_key">API Key</option>
          <option value="none">无</option>
        </select>
      </div>
      <div class="form-group">
        <label for="api_key">API Key</label>
        <input type="text" id="api_key" name="api_key" class="form-input" placeholder="sk-xxx" />
      </div>
      <div class="form-group">
        <label for="header_name">Header名称</label>
        <input type="text" id="header_name" name="header_name" class="form-input" placeholder="Authorization" value="Authorization" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">创建</button>
        <a href="/api/admin/dashboard-admin/providers" class="btn">取消</a>
      </div>
    </form>
  `;
  return c.html(adminLayout("新建API提供商", content, { csrfToken: session.csrfToken }));
});

dashboardAdmin.post("/providers", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) return c.text("CSRF 校验失败", 403);
    const name = getBodyText(body, "name").trim();
    const baseUrl = getBodyText(body, "base_url").trim();
    const apiKey = getBodyText(body, "api_key").trim() || null;
    const authType = getBodyText(body, "auth_type") || "bearer";
    const headerName = getBodyText(body, "header_name") || "Authorization";
    if (!name || !baseUrl) return c.text("名称和基础URL为必填项", 400);
    const db = getDb(c.env.DB);
    await db.insert(apiProviders).values({ name, baseUrl, apiKey, authType, headerName });
    return c.redirect("/api/admin/dashboard-admin/providers");
  } catch (error) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

dashboardAdmin.get("/providers/:id/edit", async (c) => {
  const session = getAuthenticatedSession(c);
  const id = Number.parseInt(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [provider] = await db.select().from(apiProviders).where(eq(apiProviders.id, id));
  if (!provider) return c.notFound();

  const content = `
    <h1>编辑API提供商</h1>
    <form method="post" action="/api/admin/dashboard-admin/providers/${id}" class="form">
      <input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
      <input type="hidden" name="_method" value="put" />
      <div class="form-group">
        <label for="name">名称 *</label>
        <input type="text" id="name" name="name" class="form-input" value="${escapeAttribute(provider.name)}" required />
      </div>
      <div class="form-group">
        <label for="base_url">基础URL *</label>
        <input type="text" id="base_url" name="base_url" class="form-input" value="${escapeAttribute(provider.baseUrl)}" required />
      </div>
      <div class="form-group">
        <label for="auth_type">认证方式</label>
        <select id="auth_type" name="auth_type" class="form-select">
          <option value="bearer" ${provider.authType === 'bearer' ? 'selected' : ''}>Bearer Token</option>
          <option value="api_key" ${provider.authType === 'api_key' ? 'selected' : ''}>API Key</option>
          <option value="none" ${provider.authType === 'none' ? 'selected' : ''}>无</option>
        </select>
      </div>
      <div class="form-group">
        <label for="api_key">API Key</label>
        <input type="text" id="api_key" name="api_key" class="form-input" value="${escapeAttribute(provider.apiKey || '')}" placeholder="留空则不修改" />
        <p class="form-help">当前${provider.apiKey ? '已设置' : '未设置'}</p>
      </div>
      <div class="form-group">
        <label for="header_name">Header名称</label>
        <input type="text" id="header_name" name="header_name" class="form-input" value="${escapeAttribute(provider.headerName || 'Authorization')}" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">更新</button>
        <a href="/api/admin/dashboard-admin/providers" class="btn">取消</a>
      </div>
    </form>
  `;
  return c.html(adminLayout("编辑API提供商", content, { csrfToken: session.csrfToken }));
});

dashboardAdmin.post("/providers/:id", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) return c.text("CSRF 校验失败", 403);
    const name = getBodyText(body, "name").trim();
    const baseUrl = getBodyText(body, "base_url").trim();
    const apiKey = getBodyText(body, "api_key").trim() || null;
    const authType = getBodyText(body, "auth_type") || "bearer";
    const headerName = getBodyText(body, "header_name") || "Authorization";
    if (!name || !baseUrl) return c.text("名称和基础URL为必填项", 400);
    const db = getDb(c.env.DB);
    await db.update(apiProviders)
      .set({ name, baseUrl, apiKey, authType, headerName, updatedAt: new Date().toISOString() })
      .where(eq(apiProviders.id, id));
    return c.redirect("/api/admin/dashboard-admin/providers");
  } catch (error) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

dashboardAdmin.post("/providers/:id/delete", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const body = await c.req.parseBody();
    if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) return c.text("CSRF 校验失败", 403);
    const db = getDb(c.env.DB);
    await db.delete(apiProviders).where(eq(apiProviders.id, id));
    return c.redirect("/api/admin/dashboard-admin/providers");
  } catch (error) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

export { dashboardAdmin as dashboardAdminRoutes };