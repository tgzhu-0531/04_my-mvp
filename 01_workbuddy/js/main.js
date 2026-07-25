/**
 * main.js — SPA 主入口
 * Hash-based 路由 + 页面渲染
 */

const App = (() => {
    'use strict';

    let currentRoute = 'home';
    let provinces = [];
    let configData = null;

    /* ===== 折叠工具：将 section.collapsible-section 转为可折叠 ===== */
    function initCollapsibles(container) {
        // 1. 处理已有 .collapsible-section 的 section（首页用了此方式）
        container.querySelectorAll('.collapsible-section').forEach(s => {
            const trigger = s.querySelector('.collapsible-trigger');
            if (trigger) bindCollapse(s, trigger, s.id || ('cs_' + Math.random().toString(36).slice(2,8)));
        });

        // 2. 自动检测其他页面：有 h2.section-title 的 section 自动可折叠
        container.querySelectorAll('section:not(.hero):not(.page-header):not(.collapsible-section)').forEach(section => {
            const titleEl = section.querySelector(':scope > .container > h2.section-title, :scope > .container > .section-title');
            const descEl = section.querySelector(':scope > .container > .section-desc');
            if (!titleEl) return;

            section.classList.add('collapsible-section');
            const tid = 'auto_' + (titleEl.textContent || '').trim().replace(/\s+/g, '_').slice(0, 24);

            const trigger = document.createElement('div');
            trigger.className = 'collapsible-trigger';
            trigger.style.cssText = 'display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:6px 0;user-select:none;';

            const label = document.createElement('span');
            label.innerHTML = `<strong style="font-size:1.1rem;">${titleEl.textContent}</strong>`;
            if (descEl) label.innerHTML += ` <span class="collapsible-desc">${descEl.textContent}</span>`;

            const chevron = document.createElement('span');
            chevron.className = 'collapsible-chevron';
            chevron.textContent = '▼';

            trigger.appendChild(label);
            trigger.appendChild(chevron);

            // 隐藏旧的 title/desc
            titleEl.style.display = 'none';
            if (descEl) descEl.style.display = 'none';

            // 插入 trigger
            const container_el = section.querySelector(':scope > .container');
            container_el.insertBefore(trigger, titleEl.nextSibling);

            bindCollapse(section, trigger, tid);
        });
    }

    function bindCollapse(section, trigger, key) {
        // 构建 body（trigger 之后的兄弟）
        const body = document.createElement('div');
        body.className = 'collapsible-content';
        let el = trigger.nextElementSibling;
        const nodes = [];
        while (el) { nodes.push(el); el = el.nextElementSibling; }
        nodes.forEach(n => body.appendChild(n));
        section.querySelector(':scope > .container').appendChild(body);

        // 默认折叠逻辑
        const stored = localStorage.getItem(key);
        if (stored === '1') {
            section.dataset.collapsed = 'true';
        } else if (stored === null && section.dataset.defaultCollapsed === 'true') {
            section.dataset.collapsed = 'true';
            localStorage.setItem(key, '1');
        }
        trigger.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const collapsed = section.dataset.collapsed === 'true';
            section.dataset.collapsed = collapsed ? 'false' : 'true';
            localStorage.setItem(key, section.dataset.collapsed);
        });
    }

    /* ===== 初始化 ===== */
    async function init() {
        configData = await DataLoader.loadConfig();
        provinces = await DataLoader.getProvinces();

        // 导航切换
        document.querySelector('.nav-container')?.addEventListener('click', e => {
            const link = e.target.closest('.nav-link');
            if (!link) return;
            e.preventDefault();
            const route = link.dataset.route;
            if (route) navigate(route);
        });

        // Hash 路由
        window.addEventListener('hashchange', handleHash);
        handleHash();

        // 移动端菜单
        document.querySelector('.nav-toggle')?.addEventListener('click', () => {
            document.querySelector('.nav-links')?.classList.toggle('open');
        });

        // 导航高亮
        updateActiveNav(currentRoute);
    }

    function navigate(route) {
        window.location.hash = '#' + route;
    }

    function handleHash() {
        const hash = window.location.hash.slice(1) || 'home';
        renderPage(hash);
    }

    /* ===== 导航高亮 ===== */
    function updateActiveNav(route) {
        document.querySelectorAll('.nav-link').forEach(el => {
            el.classList.toggle('active', el.dataset.route === route);
        });
    }

    /* ===== 页面渲染 ===== */
    async function renderPage(route) {
        const content = document.getElementById('page-content');
        if (!content) return;
        content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span style="color:var(--text-muted)">加载中...</span></div>';

        currentRoute = route;
        updateActiveNav(route);

        try {
            switch (route) {
                case 'home': await renderHome(content); break;
                case 'query': await renderQuery(content); break;
                case 'sources': await renderSources(content); break;
                case 'missing': await renderMissing(content); break;
                case 'about': renderAbout(content); break;
                default:
                    if (route.startsWith('province-')) {
                        const id = route.split('-')[1];
                        await renderProvince(content, id);
                    } else {
                        await renderHome(content);
                    }
            }
        } catch (err) {
            content.innerHTML = `<div class="container"><div class="info-card"><h3>⚠️ 加载出错</h3><p>${err.message}</p></div></div>`;
        }

        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ============= 首页（面向业务用户） ============= */
    async function renderHome(container) {
        const stats = await DataLoader.getStats();
        const sources = await DataLoader.getDataSources();
        const lastUpdate = sources.length > 0 ? sources[0].collect_date || sources[0].publish_date || '' : '';
        const comparison = await DataLoader.getComparisonData();
        const categoryOrder = ['尖峰', '高峰', '平段', '低谷', '深谷'];

        // 生成分析结论（基于数据）
        const analysisLines = [];
        // 峰谷价差最大的省份
        const sortedByPv = [...comparison].filter(c => c.pvRatio).sort((a, b) => b.pvRatio - a.pvRatio);
        if (sortedByPv.length > 0) {
            const top = sortedByPv[0];
            analysisLines.push(`${top.name}的峰谷价差最大（约${top.pvRatio}倍），通过错峰用电可显著降低电费成本。`);
        }
        // 时段结构最精细的
        const maxCategories = Math.max(...comparison.map(c => Object.keys(c.prices).filter(k => c.prices[k] !== null).length));
        const mostDetailed = comparison.filter(c => Object.keys(c.prices).filter(k => c.prices[k] !== null).length === maxCategories);
        if (mostDetailed.length > 0) {
            analysisLines.push(`${mostDetailed.map(c => c.name).join('、')}采用${maxCategories}段式电价结构，时段划分最为精细。`);
        }
        // 时段结构最简单的
        const minCategories = Math.min(...comparison.map(c => Object.keys(c.prices).filter(k => c.prices[k] !== null).length));
        const simplest = comparison.filter(c => Object.keys(c.prices).filter(k => c.prices[k] !== null).length === minCategories);
        if (simplest.length > 0 && simplest[0].name !== mostDetailed[0]?.name) {
            analysisLines.push(`${simplest.map(c => c.name).join('、')}为${minCategories}段式结构，时段划分相对简化。`);
        }
        const analysisText = analysisLines.join('');

        let html = `
        <!-- 标题区 — 简洁业务导向 -->
        <section class="hero" style="padding:48px 0 36px;">
            <div class="container">
                <div class="hero-content">
                    <h1 class="hero-title" style="font-size:1.9rem;">中国城市分时电价观察站</h1>
                    <p class="hero-subtitle" style="font-size:0.95rem;">基于政府公开政策文件的重点省份分时电价数据查询平台 · 数据截至 ${lastUpdate}</p>
                </div>
            </div>
        </section>

        <!-- 数据摘要条 — 数字可点击穿透 -->
        <div style="background:var(--bg-alt);padding:10px 0;border-bottom:1px solid var(--border);">
            <div class="container" style="display:flex;flex-wrap:wrap;gap:6px 20px;justify-content:center;font-size:0.82rem;color:var(--text-secondary);">
                <span>📊 已收录 <a href="#query" style="color:var(--primary);font-weight:700;text-decoration:underline;text-underline-offset:3px;">${stats.province_count}</a> 个省份</span>
                <span>·</span>
                <span><a href="#query" style="color:var(--primary);font-weight:700;text-decoration:underline;text-underline-offset:3px;">${stats.policy_count}</a> 条电价政策</span>
                <span>·</span>
                <span><a href="#query" style="color:var(--primary);font-weight:700;text-decoration:underline;text-underline-offset:3px;">${stats.period_count}</a> 个分时时段</span>
                <span>·</span>
                <span><a href="#sources" style="color:var(--primary);font-weight:700;text-decoration:underline;text-underline-offset:3px;">${stats.source_count}</a> 个可追溯来源</span>
            </div>
        </div>

        <!-- 一句话分析结论 -->
        <section class="comparison-section" style="padding-bottom:0;">
            <div class="container">
                <div class="conclusion-card">
                    <div class="conclusion-label">📊 数据分析结论 · ${analysisText}</div>
                </div>
            </div>
        </section>

        <!-- Top5 价格对比表 —— 可折叠 -->
        <section class="collapsible-section comparison-section" id="home-compare" data-default-collapsed="true">
            <div class="container">
                <div class="collapsible-trigger" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:8px 0 4px;user-select:none;">
                    <span>
                        <span style="font-weight:700;font-size:1.1rem;">Top5 样本省份分时电价对比</span>
                        <span class="collapsible-desc">典型季节的代表性时段价格（单位：元/kWh）</span>
                    </span>
                    <span class="collapsible-chevron">▼</span>
                </div>
                <div class="collapsible-content">
                    <div class="table-wrapper" style="margin-top:12px;">
                        <table class="comparison-table">
                        <thead>
                            <tr>
                                <th>省份</th>
                                ${categoryOrder.map(c => `<th>${c}</th>`).join('')}
                                <th>峰谷价差</th>
                                <th>数据状态</th>
                                <th>来源</th>
                            </tr>
                        </thead>
                        <tbody>`;

        for (const c of comparison) {
            html += `<tr>
                <td><a href="#province-${c.id}" style="font-weight:600;">${c.name}</a></td>`;
            for (const cat of categoryOrder) {
                const price = c.prices[cat];
                if (price !== null && price !== undefined) {
                    const cls = cat === '尖峰' || cat === '高峰' ? 'price-high' : (cat === '低谷' || cat === '深谷' ? 'price-low' : '');
                    html += `<td class="${cls}">${price.toFixed(3)}</td>`;
                } else {
                    html += `<td class="na">不适用</td>`;
                }
            }
            // 峰谷价差
            const pvClass = c.pvRatio >= 10 ? 'pv-high' : (c.pvRatio >= 5 ? 'pv-mid' : 'pv-low');
            html += `<td class="${pvClass}">${c.pvRatio ? c.pvRatio + '倍' : '—'}</td>`;
            // 数据状态
            const statusClass = c.dataStatus === '全部真实' ? 'badge-real' : 'badge-sample';
            html += `<td><span class="badge ${statusClass}">${c.dataStatus}</span></td>`;
            // 来源
            html += `<td style="font-size:0.75rem;color:var(--text-muted);">${c.sourceCount} 个来源</td>`;
            html += `</tr>`;
        }

        html += `</tbody></table>
                    </div>
                </div>
            </div>
        </section>

        <!-- 五省24h电价曲线对比 —— 可折叠 -->
        <section class="collapsible-section comparison-section section-alt" id="home-chart">
            <div class="container">
                <div class="collapsible-trigger" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:8px 0 4px;user-select:none;">
                    <span>
                        <span style="font-weight:700;font-size:1.1rem;">五省 24 小时电价曲线对比</span>
                        <span class="collapsible-desc">各省份典型季节的日内电价走势（多条曲线叠加）</span>
                    </span>
                    <span class="collapsible-chevron">▼</span>
                </div>
                <div class="collapsible-content">
                    <div class="chart-container" style="min-height:400px;margin-top:12px;">
                        <canvas id="multiChart" width="800" height="400"></canvas>
                    </div>
                </div>
            </div>
        </section>

        <!-- 省份卡片（快速入口）—— 可折叠 -->
        <section class="collapsible-section comparison-section" id="home-cards" data-default-collapsed="true">
            <div class="container">
                <div class="collapsible-trigger" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:8px 0 4px;user-select:none;">
                    <span>
                        <span style="font-weight:700;font-size:1.1rem;">样本省份详情</span>
                        <span class="collapsible-desc">点击查看各省完整的分时电价政策、时段和数据来源</span>
                    </span>
                    <span class="collapsible-chevron">▼</span>
                </div>
                <div class="collapsible-content">
                    <div class="province-grid" id="home-province-grid" style="margin-top:12px;"></div>
                </div>
            </div>
        </section>

        <!-- 来源与缺失数据入口 -->
        <section class="comparison-section section-alt">
            <div class="container" style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
                <a href="#sources" class="province-card" style="padding:20px;min-width:200px;text-align:center;">
                    <div style="font-size:2rem;margin-bottom:8px;">📡</div>
                    <div style="font-weight:700;color:var(--text-primary);">数据源中心</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">${sources.length} 个来源 · 全部可追溯</div>
                </a>
                <a href="#missing" class="province-card" style="padding:20px;min-width:200px;text-align:center;">
                    <div style="font-size:2rem;margin-bottom:8px;">⚠️</div>
                    <div style="font-weight:700;color:var(--text-primary);">缺失数据说明</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">已记录检索过程与判断依据</div>
                </a>
                <a href="#about" class="province-card" style="padding:20px;min-width:200px;text-align:center;">
                    <div style="font-size:2rem;margin-bottom:8px;">📖</div>
                    <div style="font-weight:700;color:var(--text-primary);">方法说明</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">数据字典 · 配置方式</div>
                </a>
            </div>
        </section>`;

        container.innerHTML = html;

        // 渲染省份卡片列表
        const grid = document.getElementById('home-province-grid');
        if (grid && provinces.length > 0) {
            for (const p of provinces) {
                const policies = await DataLoader.getPoliciesByRegion(p.id);
                const periods = await DataLoader.getTimePeriods(p.id);
                grid.innerHTML += `
                <a href="#province-${p.id}" class="province-card">
                    <div class="province-card-header">
                        <h3 class="province-name">${p.name}</h3>
                        <span class="province-code">${p.code}</span>
                    </div>
                    <div class="province-card-stats">
                        <div class="p-stat"><span class="p-stat-value">${policies.length}</span><span class="p-stat-label">政策数</span></div>
                        <div class="p-stat"><span class="p-stat-value">${periods.length}</span><span class="p-stat-label">时段数</span></div>
                        <div class="p-stat"><span class="p-stat-value">${policies.filter(p2 => p2.source_name).length}</span><span class="p-stat-label">来源数</span></div>
                    </div>
                    <div class="province-card-footer"><span class="explore-link">查看详情 →</span></div>
                </a>`;
            }
        }

        // 渲染五省对比曲线
        await renderMultiChart(comparison);

        // 初始化折叠
        initCollapsibles(container);
    }

    async function renderMultiChart(comparison) {
        const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
        const preferredSeason = {
            '1': '全年',
            '2': '夏冬季',
            '3': '1-2月/12月',
            '4': '夏冬季',
            '5': '大风季(1-5月,9-12月)',
        };

        const allCurves = [];
        for (const c of comparison) {
            const periods = await DataLoader.getTimePeriods(c.id);
            const seasonPeriods = periods.filter(p => p.season_type === preferredSeason[c.id]);
            const prices = PriceCharts.build24hCurve(seasonPeriods.length > 0 ? seasonPeriods : periods, null);
            allCurves.push({ province: c.name, prices });
        }

        if (document.getElementById('multiChart')) {
            PriceCharts.renderMultiCurve('multiChart', hours, allCurves);
        }
    }

    /* ============= 省份查询 ============= */
    async function renderQuery(container) {
        let html = `
        <section class="page-header">
            <div class="container">
                <h1 class="page-title">省份查询</h1>
                <p class="page-desc">浏览 5 个样本省份的分时电价政策与数据状态</p>
            </div>
        </section>
        <section class="section">
            <div class="container">
                <div class="query-filter">
                    <div class="search-box">
                        <input type="text" id="querySearch" placeholder="搜索省份名称..." class="search-input">
                        <span class="search-icon">🔍</span>
                    </div>
                    <div class="filter-tags" id="filterTags">
                        <span class="filter-tag active" data-filter="all">全部省份</span>
                        <span class="filter-tag" data-filter="real">有真实数据</span>
                    </div>
                </div>
                <div class="province-grid" id="queryProvinceGrid"></div>
            </div>
        </section>`;
        container.innerHTML = html;

        const grid = document.getElementById('queryProvinceGrid');
        if (grid) {
            for (const p of provinces) {
                const policies = await DataLoader.getPoliciesByRegion(p.id);
                const periods = await DataLoader.getTimePeriods(p.id);
                grid.innerHTML += `
                <a href="#province-${p.id}" class="province-card province-card-lg" data-name="${p.name}" data-count="${policies.length}">
                    <div class="province-card-header">
                        <h3 class="province-name">${p.name}</h3>
                        <span class="province-code">${p.code}</span>
                    </div>
                    <div class="province-card-stats">
                        <div class="p-stat"><span class="p-stat-value">${policies.length}</span><span class="p-stat-label">政策数</span></div>
                        <div class="p-stat"><span class="p-stat-value">${periods.length}</span><span class="p-stat-label">时段数</span></div>
                        <div class="p-stat"><span class="p-stat-value">${policies.filter(p2 => p2.source_name).length}</span><span class="p-stat-label">来源数</span></div>
                    </div>
                    <div class="province-card-footer"><span class="explore-link">查看详情 →</span></div>
                </a>`;
            }
        }

        // 搜索过滤
        document.getElementById('querySearch')?.addEventListener('input', filterQueryCards);
        document.querySelectorAll('#filterTags .filter-tag').forEach(tag => {
            tag.addEventListener('click', function() {
                document.querySelectorAll('#filterTags .filter-tag').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                filterQueryCards();
            });
        });
    }

    function filterQueryCards() {
        const query = (document.getElementById('querySearch')?.value || '').toLowerCase();
        const activeFilter = document.querySelector('#filterTags .filter-tag.active')?.dataset?.filter || 'all';
        document.querySelectorAll('.province-card-lg').forEach(card => {
            const name = (card.dataset.name || '').toLowerCase();
            const count = parseInt(card.dataset.count || '0');
            const matchesSearch = name.includes(query);
            const matchesFilter = activeFilter === 'all' || (activeFilter === 'real' && count > 0);
            card.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
        });
        initCollapsibles(container);
    }

    /* ============= 省份详情 ============= */
    async function renderProvince(container, id) {
        const provinceList = await DataLoader.getProvinceById(id);
        if (!provinceList || provinceList.length === 0) {
            container.innerHTML = '<div class="container"><div class="info-card"><h3>未找到该省份</h3></div></div>';
            return;
        }
        const province = provinceList[0];
        const policies = await DataLoader.getPoliciesByRegion(id);
        const allPeriods = await DataLoader.getTimePeriods(id);

        // 按季节分组
        const seasons = {};
        allPeriods.forEach(p => {
            const s = p.season_type || '全年';
            if (!seasons[s]) seasons[s] = [];
            seasons[s].push(p);
        });

        let html = `
        <section class="page-header" style="padding:24px 0;">
            <div class="container" style="text-align:left;">
                <a href="#query" class="back-link">← 返回查询</a>
                <h1 class="page-title" style="text-align:center;">${province.name}</h1>
                <p class="page-desc" style="text-align:center;">行政区划代码: ${province.code || '—'} | ${policies.length} 条电价政策</p>
            </div>
        </section>
        <section class="section">
            <div class="container">
                <h2 class="section-title" style="margin-bottom:16px;">📋 电价政策</h2>
                <div class="policy-list">`;

        for (const p of policies) {
            const badgeClass = p.data_type === 'real' ? 'badge-real' : 'badge-sample';
            const badgeLabel = p.data_type === 'real' ? '真实数据' : '示例数据';
            html += `
                <div class="policy-card">
                    <div class="policy-title">${p.title} <span class="badge ${badgeClass}">${badgeLabel}</span></div>
                    <div class="policy-meta">
                        <span class="policy-meta-item">文号: ${p.policy_doc_number || '—'}</span>
                        <span class="policy-meta-item">用户类型: ${p.user_type || '—'}</span>
                        <span class="policy-meta-item">电压等级: ${p.voltage_level || '—'}</span>
                        <span class="policy-meta-item">季节: ${p.season_type || '—'}</span>
                        ${p.flat_price ? `<span class="policy-meta-item">平段电价: ¥${parseFloat(p.flat_price).toFixed(4)}</span>` : ''}
                        <span class="policy-meta-item">生效: ${p.effective_date || '—'}</span>
                    </div>
                    ${p.notes ? `<p class="policy-notes">${p.notes}</p>` : ''}
                    <p class="policy-source">📄 来源: ${p.source_name || '—'} ${p.source_url ? `· <a href="${p.source_url}" target="_blank">查看原文</a>` : ''}</p>
                </div>`;
        }

        html += `</div></div></section>`;

        // 时段表
        html += `<section class="section section-alt"><div class="container"><h2 class="section-title" style="margin-bottom:16px;">⏰ 分时时段</h2>`;
        for (const [season, periods] of Object.entries(seasons)) {
            html += `<h3 style="font-size:1rem;font-weight:600;margin:16px 0 8px;color:var(--text-secondary);">${season}</h3>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr>
                        <th>原始名称</th><th>标准分类</th><th>开始时间</th><th>结束时间</th>
                        <th>电价 (元/kWh)</th><th>浮动比例</th><th>数据类型</th>
                    </tr></thead>
                    <tbody>`;
            for (const tp of periods) {
                const badgeClass = tp.data_type === 'real' ? 'badge-real' : 'badge-sample';
                const badgeLabel = tp.data_type === 'real' ? '真实' : '示例';
                const price = tp.price ? parseFloat(tp.price).toFixed(4) : '按比例';
                html += `<tr>
                    <td>${tp.original_name}</td>
                    <td><span class="badge badge-real">${tp.standard_category}</span></td>
                    <td>${tp.start_time}</td><td>${tp.end_time}</td>
                    <td>${price}</td>
                    <td>${tp.float_ratio || '—'}</td>
                    <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                </tr>`;
            }
            html += `</tbody></table></div>`;
        }
        html += `</div></section>`;

        // 电价曲线
        const seasonKeys = Object.keys(seasons);
        html += `<section class="section"><div class="container"><h2 class="section-title" style="margin-bottom:16px;">📈 分时电价曲线</h2>`;

        if (seasonKeys.length > 1) {
            html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;" id="curve-tabs">`;
            seasonKeys.forEach((s, i) => {
                html += `<span class="filter-tag ${i === 0 ? 'active' : ''}" data-season="${s}">${s}</span>`;
            });
            html += `</div>`;
        }

        html += `<div class="chart-container"><canvas id="provinceChart" width="800" height="350"></canvas></div>
        <div class="chart-legend">
            <div class="legend-item"><span class="legend-dot sharp"></span>尖峰</div>
            <div class="legend-item"><span class="legend-dot peak"></span>高峰</div>
            <div class="legend-item"><span class="legend-dot flat"></span>平段</div>
            <div class="legend-item"><span class="legend-dot valley"></span>低谷</div>
            <div class="legend-item"><span class="legend-dot deep"></span>深谷</div>
        </div>
        </div></section>`;

        container.innerHTML = html;

        // 渲染曲线
        const defaultSeason = seasonKeys[0] || '全年';
        renderProvinceChart(seasons, defaultSeason, province.name);

        // 季节切换
        document.querySelectorAll('#curve-tabs .filter-tag').forEach(tag => {
            tag.addEventListener('click', function() {
                document.querySelectorAll('#curve-tabs .filter-tag').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                renderProvinceChart(seasons, this.dataset.season, province.name);
            });
        });
        initCollapsibles(container);
    }

    function renderProvinceChart(seasons, season, provinceName) {
        const periods = seasons[season] || [];
        const flatPrice = periods.length > 0 ? 0.7 : 0.7;
        const prices = PriceCharts.build24hCurve(periods, flatPrice);
        const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
        const segColors = PriceCharts.getSegmentColors(prices, periods);

        // 销毁旧图表
        const canvas = document.getElementById('provinceChart');
        if (!canvas) return;
        const oldChart = Chart.getChart(canvas);
        if (oldChart) oldChart.destroy();

        PriceCharts.renderCurve('provinceChart', hours, prices, segColors);
    }

    /* ============= 数据源中心 ============= */
    async function renderSources(container) {
        const sources = await DataLoader.getDataSources();
        let html = `
        <section class="page-header">
            <div class="container">
                <h1 class="page-title">📡 数据源中心</h1>
                <p class="page-desc">${sources.length} 个数据来源 | 全部来自政府及国企官网的公开文件</p>
            </div>
        </section>
        <section class="section">
            <div class="container">
                <div class="source-grid">`;

        for (const s of sources) {
            const reliabilityMap = { high: '高可信', medium: '中等', low: '低', unverified: '未验证' };
            const rel = reliabilityMap[s.reliability] || s.reliability;
            const relClass = s.reliability === 'high' ? 'badge-real' : 'badge-sample';
            html += `
            <div class="source-card">
                <div class="source-name">${s.source_name} <span class="badge ${relClass}">${rel}</span></div>
                ${s.source_url ? `<div class="source-url">🔗 <a href="${s.source_url}" target="_blank" rel="noopener noreferrer">${s.source_url}</a></div>` : '<div class="source-url">—</div>'}
                <div class="source-meta">
                    <span>🏛️ ${s.publish_authority || '—'}</span>
                    <span>📅 发布: ${s.publish_date || '—'}</span>
                    <span>📥 采集: ${s.collect_date || '—'}</span>
                    <span>📄 ${s.doc_type || '—'}</span>
                </div>
                ${s.notes ? `<div class="source-provinces">📝 ${s.notes}</div>` : ''}
            </div>`;
        }

        html += `</div></div></section>`;
        container.innerHTML = html;
        initCollapsibles(container);
    }

    /* ============= 缺失数据 ============= */
    async function renderMissing(container) {
        const records = await DataLoader.getMissingRecords();
        let html = `
        <section class="page-header">
            <div class="container">
                <h1 class="page-title">⚠️ 缺失数据说明</h1>
                <p class="page-desc">以下数据经公开检索后无法找到稳定可靠的官方来源</p>
            </div>
        </section>
        <section class="section">
            <div class="container">
                <div class="missing-summary">
                    <div class="missing-summary-card">
                        <span class="ms-icon">🔍</span>
                        <strong>${records.length}</strong> 项缺失/待验证数据记录
                    </div>
                </div>
                <div class="missing-list">`;

        for (const r of records) {
            const statusMap = { missing: '缺失', unverified: '待验证', pending: '处理中' };
            const badgeMap = { missing: 'badge-missing', unverified: 'badge-unverified', pending: 'badge-sample' };
            html += `
            <div class="missing-card">
                <div class="missing-card-header">
                    <div class="missing-title-row">
                        <h3 class="missing-province">${r.province}</h3>
                        <span class="badge ${badgeMap[r.status] || 'badge-missing'}">${statusMap[r.status] || r.status}</span>
                    </div>
                    ${r.city ? `<p class="missing-city">城市: ${r.city}</p>` : ''}
                </div>
                <div class="missing-card-body">
                    <div class="missing-field"><span class="missing-label">缺失字段:</span> ${r.data_field}</div>
                    <div class="missing-field"><span class="missing-label">用户类型:</span> ${r.user_type || '—'}</div>
                    <div class="missing-field"><span class="missing-label">检索过程:</span><p class="missing-process">${r.search_process}</p></div>
                    ${r.search_keywords ? `<div class="missing-field"><span class="missing-label">检索关键词:</span> <span class="missing-keywords">${r.search_keywords}</span></div>` : ''}
                    <div class="missing-field"><span class="missing-label">判断依据:</span><p class="missing-basis">${r.judgment_basis}</p></div>
                </div>
            </div>`;
        }

        html += `</div>
        <div class="info-card" style="margin-top:2rem;">
            <h3>📝 重要说明</h3>
            <ul>
                <li>以上所有"缺失"标记的数据，均经过公开互联网检索后确认无法找到稳定、可验证的官方公开来源。</li>
                <li>"待验证"标记表示存在相关来源但信息不完整或需要人工复核。</li>
                <li>本平台严格遵守不编造数据的原则。缺失数据不会被伪造，而是明确标注。</li>
            </ul>
        </div></div></section>`;

        container.innerHTML = html;
        initCollapsibles(container);
    }

    /* ============= 关于/方法说明 ============= */
    async function renderAbout(container) {
        const mode = (await DataLoader.getMode()) || 'csv';
        container.innerHTML = `
        <section class="page-header">
            <div class="container">
                <h1 class="page-title">📖 方法说明</h1>
                <p class="page-desc">数据采集、建模、架构和使用方法</p>
            </div>
        </section>
        <section class="section">
            <div class="container">
                <div class="method-grid">
                    <div class="method-card">
                        <div class="method-icon">🔍</div>
                        <h2 class="method-title">数据采集方法</h2>
                        <ul class="method-list">
                            <li>优先使用省级/地市级发改委官网、电网公司官网</li>
                            <li>采集政府公开公告、政策文件、PDF附件</li>
                            <li>每条数据记录来源URL、发布机构、发布时间</li>
                            <li>无法找到来源的数据标记为"缺失"而非编造</li>
                            <li>当前数据源模式: <strong>${mode.toUpperCase()}</strong></li>
                        </ul>
                    </div>
                    <div class="method-card">
                        <div class="method-icon">🗄️</div>
                        <h2 class="method-title">数据模型</h2>
                        <ul class="method-list">
                            <li><strong>regions</strong>: 行政区域（省/市/区三级）</li>
                            <li><strong>policies</strong>: 电价政策</li>
                            <li><strong>time_periods</strong>: 分时时段</li>
                            <li><strong>data_sources</strong>: 数据来源</li>
                            <li><strong>missing_records</strong>: 缺失数据记录</li>
                        </ul>
                    </div>
                    <div class="method-card">
                        <div class="method-icon">⚙️</div>
                        <h2 class="method-title">技术架构</h2>
                        <ul class="method-list">
                            <li>前端: 纯静态 SPA (HTML/CSS/JS)</li>
                            <li>数据: CSV 或 SQLite + Flask API</li>
                            <li>图表: Chart.js</li>
                            <li>配置: JSON 文件切换数据源</li>
                            <li>兼容: Windows IIS 静态站点</li>
                            <li>编码: 全站 UTF-8</li>
                        </ul>
                    </div>
                    <div class="method-card">
                        <div class="method-icon">🔄</div>
                        <h2 class="method-title">数据源切换</h2>
                        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">修改 config.json 中的 selected 字段来切换数据源:</p>
                        <div class="code-block"><pre><code>{
  "selected": "csv",
  "csv": { "dataDir": "data/csv/" }
}

// 改为 sqlite 模式:
{
  "selected": "sqlite",
  "sqlite": {
    "dbPath": "data/electricity_pricing.db",
    "apiBaseUrl": "http://localhost:5000/api"
  }
}</code></pre></div>
                        <p class="method-note">切换到 sqlite 模式后，需要先启动后端服务: cd server && python app.py</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="section section-alt">
            <div class="container">
                <div class="section-header"><h2 class="section-title">📄 数据字典</h2></div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>表名</th><th>字段</th><th>说明</th></tr></thead>
                        <tbody>
                            <tr><td>regions</td><td>id, code, name, level, parent_id, province_code</td><td>行政区域（省/市/区）</td></tr>
                            <tr><td>policies</td><td>id, region_id, title, policy_doc_number, user_type, voltage_level, season_type, flat_price, price_unit, effective_date, expiry_date, source_id, notes, data_type</td><td>电价政策</td></tr>
                            <tr><td>time_periods</td><td>id, policy_id, region_id, season_type, original_name, standard_category, start_time, end_time, price, float_ratio, user_type, voltage_level, data_type</td><td>分时时段</td></tr>
                            <tr><td>data_sources</td><td>id, source_name, source_url, publish_authority, publish_date, collect_date, reliability, doc_type, notes</td><td>数据来源</td></tr>
                            <tr><td>missing_records</td><td>id, province, city, user_type, data_field, search_process, search_keywords, searched_urls, judgment_basis, status</td><td>缺失记录</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>`;
        initCollapsibles(container);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
