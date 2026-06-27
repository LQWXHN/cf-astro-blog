import { Hono } from "hono";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { toolCategories, toolItems } from "@/db/schema";
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

const tools = new Hono<AdminAppEnv>();
tools.use("*", requireAuth);

// ============ 工具管理首页 ============
tools.get("/", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const db = getDb(c.env.DB);

    // 获取所有分类
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

    // 获取所有工具（用于下拉框搜索）
    const allTools = await db
      .select({
        id: toolItems.id,
        name: toolItems.name,
        description: toolItems.description,
        url: toolItems.url,
        icon: toolItems.icon,
        categoryName: toolCategories.name,
      })
      .from(toolItems)
      .leftJoin(toolCategories, eq(toolItems.categoryId, toolCategories.id))
      .orderBy(asc(toolCategories.name), asc(toolItems.sortOrder), asc(toolItems.name));

    // 构建分类表格
    const categoriesHtml =
      categories.length === 0
        ? `<tr><td colspan="3" class="empty-state">暂无分类，请先创建。</td></tr>`
        : categories
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
            .join("");

    // 构建工具表格
    const itemsHtml =
      allTools.length === 0
        ? `<tr><td colspan="4" class="empty-state">暂无工具，请添加。</td></tr>`
        : allTools
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

    // 将工具数据序列化到页面中
    const toolsJson = JSON.stringify(allTools);

    const content = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <h1 style="margin: 0;">工具箱管理</h1>
        <div class="page-actions" style="margin: 0;">
          <a href="/api/admin/tools/categories/new" class="btn btn-primary">新建分类</a>
          <a href="/api/admin/tools/items/new" class="btn">新建工具</a>
        </div>
      </div>

      <!-- ===== 快速跳转搜索框（实时下拉框） ===== -->
      <div class="tools-quick-search">
        <div class="tools-quick-search-box">
          <input
            type="text"
            id="toolsQuickSearchInput"
            placeholder="快速跳转：输入关键词进行搜索..."
            class="tools-quick-search-input"
            autocomplete="off"
          />
          <span id="toolsQuickSearchClear" class="tools-quick-search-clear" style="display: none;">✕</span>
        </div>
        <div class="tools-quick-dropdown" id="toolsQuickDropdown" style="display:none;">
          <ul id="toolsQuickResults"></ul>
          <div class="tools-quick-footer">
            找到 <span id="toolsQuickCount">0</span> 个工具
          </div>
        </div>
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
            ${categoriesHtml}
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
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <script>
        (function() {
          const allTools = ${toolsJson};
          const searchInput = document.getElementById('toolsQuickSearchInput');
          const clearBtn = document.getElementById('toolsQuickSearchClear');
          const dropdown = document.getElementById('toolsQuickDropdown');
          const resultsList = document.getElementById('toolsQuickResults');
          const countSpan = document.getElementById('toolsQuickCount');

          function renderDropdown(query) {
            const q = query.trim().toLowerCase();
            let filtered = [];
            if (q) {
              filtered = allTools.filter(tool =>
                tool.name.toLowerCase().includes(q) ||
                (tool.description && tool.description.toLowerCase().includes(q))
              );
            }

            if (filtered.length === 0 || !q) {
              dropdown.style.display = 'none';
              return;
            }

            resultsList.innerHTML = filtered.map(tool => {
              const iconHtml = tool.icon
                ? `<img src="${escapeHtml(tool.icon)}" alt="" />`
                : `<span class="tools-quick-icon-placeholder">${escapeHtml(tool.name.charAt(0))}</span>`;
              return \`
                <li data-url="\${escapeHtml(tool.url)}">
                  <div class="tools-quick-icon">\${iconHtml}</div>
                  <div class="tools-quick-info">
                    <span class="tools-quick-name">\${escapeHtml(tool.name)}</span>
                    <span class="tools-quick-desc">\${escapeHtml(tool.description || '')}</span>
                  </div>
                </li>
              \`;
            }).join('');

            countSpan.textContent = filtered.length;
            dropdown.style.display = 'flex';

            // 点击跳转
            resultsList.querySelectorAll('li').forEach(li => {
              li.addEventListener('click', () => {
                window.open(li.dataset.url, '_blank');
                dropdown.style.display = 'none';
                searchInput.value = '';
                clearBtn.style.display = 'none';
              });
            });
          }

          searchInput.addEventListener('input', () => {
            const val = searchInput.value;
            clearBtn.style.display = val ? 'inline-block' : 'none';
            renderDropdown(val);
          });

          searchInput.addEventListener('blur', () => {
            setTimeout(() => { dropdown.style.display = 'none'; }, 200);
          });

          searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) renderDropdown(searchInput.value);
          });

          clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            dropdown.style.display = 'none';
            searchInput.focus();
          });

          // 键盘导航
          let selectedIndex = -1;
          searchInput.addEventListener('keydown', (e) => {
            const items = resultsList.querySelectorAll('li');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
              e.preventDefault();
              selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
              updateSelected(items);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              selectedIndex = Math.max(selectedIndex - 1, -1);
              updateSelected(items);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (selectedIndex >= 0 && items[selectedIndex]) {
                window.open(items[selectedIndex].dataset.url, '_blank');
                dropdown.style.display = 'none';
                searchInput.value = '';
                clearBtn.style.display = 'none';
                selectedIndex = -1;
              }
            }
          });

          function updateSelected(items) {
            items.forEach((item, index) => {
              item.style.background = index === selectedIndex ? 'rgba(10,132,255,0.12)' : '';
              if (index === selectedIndex) item.scrollIntoView({ block: 'nearest' });
            });
          }

          // 转义函数（用于内联脚本）
          function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          }

          dropdown.style.display = 'none';
        })();
      </script>
    `;

    return c.html(adminLayout("工具箱管理", content, { csrfToken: session.csrfToken }));
  } catch (error: any) {
    console.error("Tools page error:", error);
    return c.text(`错误: ${error.message}\n\n堆栈:\n${error.stack}`, 500);
  }
});

// ============ 分类管理 ============
tools.get("/categories/new", async (c) => {
  try {
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
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
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
    const db = getDb(c.env.DB);
    await db.insert(toolCategories).values({ name, sortOrder });
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

tools.get("/categories/:id/edit", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB);
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
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
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
    const db = getDb(c.env.DB);
    await db
      .update(toolCategories)
      .set({ name, sortOrder, updatedAt: new Date().toISOString() })
      .where(eq(toolCategories.id, id));
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
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
    const db = getDb(c.env.DB);
    await db.delete(toolCategories).where(eq(toolCategories.id, id));
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

// ============ 工具条目管理 ============
tools.get("/items/new", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const db = getDb(c.env.DB);
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
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
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
    const db = getDb(c.env.DB);
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
    return c.text(`错误: ${error.message}`, 500);
  }
});

tools.get("/items/:id/edit", async (c) => {
  try {
    const session = getAuthenticatedSession(c);
    const id = Number.parseInt(c.req.param("id"));
    const db = getDb(c.env.DB);
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
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
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
    const db = getDb(c.env.DB);
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
    return c.text(`错误: ${error.message}`, 500);
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
    const db = getDb(c.env.DB);
    await db.delete(toolItems).where(eq(toolItems.id, id));
    return c.redirect("/api/admin/tools");
  } catch (error: any) {
    return c.text(`错误: ${error.message}`, 500);
  }
});

export { tools as toolsRoutes };