// ============================================================
// 城市分时电价观察站 - 主应用逻辑
// 负责页面渲染、交互控制和数据绑定
// ============================================================

const App = {
    // 初始化
    async init() {
        const loadingEl = document.getElementById('loading');
        const errorEl = document.getElementById('error');
        const contentEl = document.getElementById('content');

        try {
            // 加载配置
            await AppConfig.load();
            const mode = AppConfig.getMode();
            const isSQLite = mode === 'sqlite';
            const modeLabel = isSQLite ? 'SQLite 数据库' : 'CSV 文件';
            const modeIcon = isSQLite ? '🗄️' : '📁';
            const modeHint = isSQLite ? '本地完整验证 · 需后端服务 (npm start)' : '静态展示 · 无需后端服务';

            // 更新顶部固定模式指示条
            const indicatorBar = document.getElementById('mode-indicator-bar');
            if (indicatorBar) {
                indicatorBar.className = `mode-indicator-bar ${mode}`;
            }

            // 更新导航栏模式徽章
            const badge = document.getElementById('data-source-badge');
            badge.textContent = modeLabel;
            badge.className = `data-source-badge ${mode}`;

            // 更新页面顶部模式横幅
            const banner = document.getElementById('mode-banner');
            if (banner) {
                banner.className = `mode-banner ${mode}`;
                banner.querySelector('.mode-icon').textContent = modeIcon;
                banner.querySelector('.mode-label').textContent = `当前模式: ${modeLabel}`;
                const hintEl = document.getElementById('mode-banner-hint');
                if (hintEl) hintEl.textContent = modeHint;
            }

            // 更新方法卡片中的模式文本
            const methodModeText = document.getElementById('method-mode-text');
            if (methodModeText) {
                methodModeText.textContent = modeLabel;
                methodModeText.style.color = isSQLite ? '#2563EB' : '#059669';
            }

            // 更新错误提示中的模式信息
            const errorMsg = document.querySelector('.error-text');
            if (errorMsg) {
                errorMsg.dataset.mode = mode;
            }

            // 加载数据
            const [overview, sources, periods, missing] = await Promise.all([
                DataLoader.getOverview(),
                DataLoader.getSources(),
                DataLoader.getPeriods(),
                DataLoader.getMissingRecords()
            ]);

            loadingEl.classList.add('hidden');
            contentEl.classList.remove('hidden');

            // 渲染各模块
            this.renderStats(overview);
            this.renderPriceTable(overview.priceSummary);
            this.renderConclusion(overview.priceSummary);
            this.renderProvinceCards(periods);
            this.renderSources(sources);
            this.renderMissing(missing);
            this.renderMethodCard();

            // 初始化图表
            this.initChart(periods);

        } catch (e) {
            console.error('加载失败:', e);
            loadingEl.classList.add('hidden');
            errorEl.classList.remove('hidden');
            const mode = AppConfig.getMode();
            const modeHint = mode === 'sqlite'
                ? '请确保后端服务已启动 (npm start)'
                : '请确保 CSV 数据文件完整';
            errorEl.querySelector('.error-text').textContent =
                `数据加载失败: ${e.message}。${modeHint}。`;
        }
    },

    // 渲染统计卡片
    renderStats(overview) {
        document.getElementById('province-count').textContent = overview.provinceCount;
        document.getElementById('source-count').textContent = overview.sourceCount;
        document.getElementById('policy-count').textContent = overview.policyCount;
        document.getElementById('period-count').textContent = overview.periodCount;
        document.getElementById('missing-count').textContent = overview.missingCount;
        document.getElementById('update-date').textContent = '2026-07-25';
    },

    // 渲染价格对比表格
    renderPriceTable(priceSummary) {
        const tbody = document.getElementById('price-table-body');
        if (!priceSummary || priceSummary.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="color:var(--gray-400);">暂无数据</td></tr>';
            return;
        }
        tbody.innerHTML = priceSummary.map(p => {
            const province = p.province;
            const cls = AppConfig.provinceClasses[province] || '';
            const color = AppConfig.provinceColors[province] || '#666';
            return `<tr>
                <td class="province-name"><span class="badge" style="background:${color}"></span>${province}</td>
                <td>${this.formatPrice(p.sharp_price, 'sharp')}</td>
                <td>${this.formatPrice(p.peak_price, 'peak')}</td>
                <td>${this.formatPrice(p.flat_price, 'flat')}</td>
                <td>${this.formatPrice(p.valley_price, 'valley')}</td>
                <td>${this.formatPrice(p.deep_valley_price, 'deep')}</td>
            </tr>`;
        }).join('');
    },

    formatPrice(price, cls) {
        if (price === null || price === undefined) {
            return `<span class="price-na">不适用</span>`;
        }
        const v = parseFloat(price);
        if (isNaN(v)) return `<span class="price-na">未公开</span>`;
        return `<span class="price-value price-${cls}">${v.toFixed(4)}</span>`;
    },

    // 渲染结论
    renderConclusion(priceSummary) {
        if (!priceSummary || priceSummary.length === 0) return;
        const el = document.getElementById('conclusion-text');

        // 分析差异
        const hasSharp = priceSummary.filter(p => p.sharp_price).length;
        const hasDeep = priceSummary.filter(p => p.deep_valley_price).length;
        const maxPeak = priceSummary.reduce((max, p) => {
            const v = parseFloat(p.peak_price);
            return v > max ? v : max;
        }, 0);
        const minValley = priceSummary.reduce((min, p) => {
            const v = parseFloat(p.valley_price);
            return v < min && !isNaN(v) ? v : min;
        }, Infinity);
        const maxProvince = priceSummary.find(p => parseFloat(p.peak_price) === maxPeak)?.province || '';
        const minProvince = priceSummary.find(p => parseFloat(p.valley_price) === minValley)?.province || '';

        let text = `Top5 样本省份工商业分时电价差异显著：`;
        text += `山东电价结构最完整，设有尖峰（最高 ${this.formatPricePlain(priceSummary.find(p => p.province === '山东')?.sharp_price)} 元/kWh）和深谷（最低 ${this.formatPricePlain(priceSummary.find(p => p.province === '山东')?.deep_valley_price)} 元/kWh）两级极端时段；`;
        text += `浙江2026年7月新政策将尖峰、高峰、低谷、深谷浮动倍率拉大至 2.05:1.85:1:0.4:0.2，峰谷价差显著扩大；`;
        text += `${maxProvince} 峰段电价最高（${maxPeak.toFixed(4)} 元/kWh），${minProvince} 谷段电价最低（${minValley.toFixed(4)} 元/kWh）；`;
        text += `广东仅7-9月高温日执行尖峰电价，江苏和内蒙古（蒙西）未设尖峰/深谷分类。`;
        text += `整体来看，北方省份（山东、内蒙古）午间光伏出力高峰期设置较长低谷时段，南方省份（广东、浙江）晚高峰电价更高。`;

        el.textContent = text;
    },

    formatPricePlain(price) {
        if (!price) return '—';
        const v = parseFloat(price);
        return isNaN(v) ? '—' : v.toFixed(4);
    },

    // 渲染省份时段卡片
    renderProvinceCards(periods) {
        // 按省份分组，取工商业时段
        const grouped = {};
        AppConfig.provinces.forEach(p => {
            const regionId = AppConfig.provinceMap[p];
            let pPeriods = periods.filter(pe => pe.region_id === regionId);
            // 去重，取代表性价格
            const seen = new Set();
            pPeriods = pPeriods.filter(pe => {
                const key = `${pe.std_category}_${pe.start_time}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            // 按标准分类排序
            const order = { '尖峰': 0, '峰': 1, '平': 2, '谷': 3, '深谷': 4 };
            pPeriods.sort((a, b) => (order[a.std_category] || 9) - (order[b.std_category] || 9));
            grouped[p] = pPeriods.slice(0, 8); // 最多显示8条
        });

        const grid = document.getElementById('province-cards');
        grid.innerHTML = AppConfig.provinces.map(province => {
            const cls = AppConfig.provinceClasses[province] || '';
            const color = AppConfig.provinceColors[province] || '#666';
            const pPeriods = grouped[province] || [];
            const rows = pPeriods.map(pe => {
                const cat = pe.std_category || '';
                const dotCls = cat === '尖峰' ? 'sharp' : cat === '峰' ? 'peak' : cat === '平' ? 'flat' : cat === '谷' ? 'valley' : cat === '深谷' ? 'deep' : '';
                const price = pe.price ? parseFloat(pe.price).toFixed(4) : '—';
                const time = pe.start_time && pe.end_time ? `${pe.start_time}-${pe.end_time}` : '';
                return `<div class="period-row">
                    <span class="period-label"><span class="period-dot ${dotCls}"></span>${cat} ${time}</span>
                    <span class="period-price" style="color:${AppConfig.categoryColors[cat] || '#666'}">${price} 元</span>
                </div>`;
            }).join('');

            const count = pPeriods.length;
            return `<div class="period-card">
                <div class="card-header ${cls}">
                    <span>${province}</span>
                    <span style="font-size:0.75rem;opacity:0.8">${count} 个时段</span>
                </div>
                <div class="card-body">
                    ${rows || '<div style="padding:12px;color:var(--gray-400);font-size:0.85rem">暂无数据</div>'}
                </div>
            </div>`;
        }).join('');
    },

    // 渲染数据来源
    renderSources(sources) {
        const container = document.getElementById('sources-body');
        container.innerHTML = sources.map((s, i) => {
            const rel = (s.reliability || '中').toLowerCase();
            return `<div class="source-item">
                <div class="source-rank">${i + 1}</div>
                <div class="source-info">
                    <div class="source-name">${s.source_name}</div>
                    <div class="source-url"><a href="${s.source_url}" target="_blank" rel="noopener">${s.source_url}</a></div>
                    <div class="source-meta">
                        <span>发布机构: ${s.issuing_authority}</span>
                        <span>发布时间: ${s.publish_date}</span>
                        <span>采集时间: ${s.collect_date}</span>
                    </div>
                </div>
                <span class="reliability-badge ${rel}">${s.reliability}</span>
            </div>`;
        }).join('');
    },

    // 渲染缺失数据
    renderMissing(missing) {
        const container = document.getElementById('missing-body');
        if (!missing || missing.length === 0) {
            container.innerHTML = '<div style="padding:20px;color:var(--gray-400)">暂无缺失记录</div>';
            return;
        }
        container.innerHTML = missing.map(m => {
            const status = (m.status || '').includes('已确认') ? 'confirmed' : 'pending';
            const statusLabel = (m.status || '').includes('已确认') ? '已确认' : '待验证';
            return `<div class="missing-item">
                <div class="missing-title">
                    ${m.field_name} - ${m.description}
                    <span class="status-badge ${status}">${statusLabel}</span>
                </div>
                <div class="missing-desc">${m.judgment_basis}</div>
                <div class="missing-search">检索过程: ${m.search_process}</div>
            </div>`;
        }).join('');
    },

    // 渲染方法说明
    renderMethodCard() {
        // 已经在 HTML 中静态写了
    },

    // 初始化图表
    async initChart(periods) {
        const canvas = document.getElementById('multi-curve-chart');
        if (!canvas) return;

        const allData = [];
        for (const province of AppConfig.provinces) {
            const pPeriods = await DataLoader.getDailyCurve(province);
            allData.push({
                province,
                periods: pPeriods,
                color: AppConfig.provinceColors[province]
            });
        }

        ChartRenderer.drawMultiCurve('multi-curve-chart', allData);
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});