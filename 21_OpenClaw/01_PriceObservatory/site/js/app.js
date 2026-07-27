/**
 * 城市分时电价观察站 MVP - 主应用脚本
 * 版本: 1.0.0
 * 说明: 根据 config.json 自动选择 CSV/SQLite 数据源模式
 */

(function() {
    'use strict';

    // ===== 全局状态 =====
    const state = {
        config: null,
        adapter: null,
        provinces: [],
        prices: [],
        dataSources: [],
        tariffTypes: [],
        charts: {},
        selectedProvince: 'all',
        selectedSeason: 'all',
        selectedCategory: 'all',
        selectedUserType: 'all',
    };

    // ===== 省份名称映射 =====
    const PROVINCE_NAMES = {
        gd: '广东省', js: '江苏省', sd: '山东省',
        zj: '浙江省', nmg: '内蒙古'
    };

    const PROVINCE_COLORS = {
        gd: '#ef4444', js: '#3b82f6', sd: '#10b981',
        zj: '#f59e0b', nmg: '#8b5cf6'
    };

    const CATEGORY_COLORS = {
        '尖峰': '#ef4444',
        '高峰': '#f97316',
        '平段': '#3b82f6',
        '低谷': '#10b981',
        '深谷': '#06b6d4'
    };

    const SEASON_LABELS = {
        summer: '夏季', winter: '冬季', normal: '非夏季',
        spring_autumn: '春秋季', all: '全年统一'
    };

    // ===== 初始化 =====
    async function init() {
        showLoading(true);
        
        try {
            // 1. 加载配置
            await loadConfig();
            
            // 2. 创建数据适配器
            createAdapter();
            
            // 3. 加载数据
            await loadAllData();
            
            // 4. 渲染界面
            renderConfigBar();
            renderPageControls();
            renderProvinceCards();
            renderComparisonChart();
            renderDataSources();
            renderPriceTable();
            renderConclusion();
            renderSourceTable();
            renderMissingDataNotes();
            
            // 5. 绑定事件
            bindEvents();
            
            showLoading(false);
        } catch (error) {
            console.error('Init error:', error);
            showError('数据加载失败: ' + error.message);
            showLoading(false);
        }
    }

    // ===== 配置加载 =====
    async function loadConfig() {
        const response = await fetch('../config.json');
        if (!response.ok) throw new Error('无法加载 config.json');
        state.config = await response.json();
    }

    // ===== 适配器创建 =====
    function createAdapter() {
        const mode = state.config.dataSource || 'csv';
        if (mode === 'sqlite') {
            state.adapter = new SQLiteAdapter();
            document.getElementById('dataModeBadge').textContent = '📦 SQLite 模式';
            document.getElementById('dataModeBadge').className = 'data-mode-badge';
        } else {
            state.adapter = new CSVAdapter('data/');
            document.getElementById('dataModeBadge').textContent = '📄 CSV 模式';
            document.getElementById('dataModeBadge').className = 'data-mode-badge csv-mode';
        }
    }

    // ===== 数据加载 =====
    async function loadAllData() {
        const [provinces, prices, dataSources, tariffTypes, summary] = await Promise.all([
            state.adapter.getProvinces(),
            state.adapter.getPrices(),
            state.adapter.getDataSources(),
            state.adapter.getTariffTypes(),
            state.adapter.getSummary()
        ]);
        
        state.provinces = provinces;
        state.prices = prices;
        state.dataSources = dataSources;
        state.tariffTypes = tariffTypes;
        state.summary = summary;
        
        // 更新统计
        document.getElementById('statProvinces').textContent = summary.totalProvinces;
        document.getElementById('statRecords').textContent = summary.totalPriceRecords;
        document.getElementById('statSources').textContent = summary.totalDataSources;
    }

    // ===== 渲染：配置栏 =====
    function renderConfigBar() {
        const mode = state.config.dataSource === 'sqlite' ? 'SQLite 数据库' : 'CSV 静态文件';
        document.getElementById('configMode').textContent = mode;
        document.getElementById('configVersion').textContent = state.config.version || '1.0.0';
        document.getElementById('configDate').textContent = state.config.dataCollectedDate || '2025-07-01';
    }

    // ===== 渲染：页面控件 =====
    function renderPageControls() {
        const selectProvince = document.getElementById('selectProvince');
        const selectSeason = document.getElementById('selectSeason');
        const selectCategory = document.getElementById('selectCategory');
        
        // 省份选择
        state.provinces.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.province_id;
            opt.textContent = p.province_name;
            selectProvince.appendChild(opt);
        });
        
        // 季节选择
        const seasons = new Set(state.prices.map(p => p.season));
        const seasonOrder = ['all', 'summer', 'winter', 'normal', 'spring_autumn'];
        const seasonNames = { all: '全部季节', summer: '夏季', winter: '冬季', normal: '非夏季', spring_autumn: '春秋季' };
        seasonOrder.forEach(s => {
            if (s === 'all' || seasons.has(s)) {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = seasonNames[s] || s;
                selectSeason.appendChild(opt);
            }
        });
        
        // 时段分类选择
        ['全部时段', '尖峰', '高峰', '平段', '低谷'].forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = i === 0 ? 'all' : name;
            opt.textContent = name;
            selectCategory.appendChild(opt);
        });
    }

    // ===== 渲染：省份卡片 =====
    function renderProvinceCards() {
        const container = document.getElementById('provinceCards');
        container.innerHTML = '';
        
        state.provinces.forEach(p => {
            const provPrices = state.prices.filter(pr => pr.province_id === p.province_id);
            const categories = [...new Set(provPrices.map(pr => pr.standard_category))];
            
            // 计算平均价格
            const avgByCategory = {};
            for (const cat of categories) {
                const catPrices = provPrices.filter(pr => pr.standard_category === cat);
                const avg = catPrices.reduce((sum, pr) => sum + parseFloat(pr.price_yuan_per_kwh), 0) / catPrices.length;
                avgByCategory[cat] = avg;
            }
            
            const card = document.createElement('div');
            card.className = 'card fade-in';
            card.dataset.province = p.province_id;
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-title">
                        <span style="color:${PROVINCE_COLORS[p.province_id] || '#3b82f6'}">${p.province_name}</span>
                        <span class="card-subtitle">${p.region}地区</span>
                    </span>
                    <span class="status-tag ${p.data_status}">${p.data_status === 'verified' ? '已验证' : '待验证'}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                    ${categories.map(cat => `
                        <div style="display:flex;flex-direction:column;align-items:center;padding:8px;background:rgba(51,65,85,0.3);border-radius:6px;">
                            <span style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">${cat}</span>
                            <span class="price-tag price-${cat === '尖峰' ? 'sharp-peak' : cat === '高峰' ? 'peak' : cat === '平段' ? 'flat' : cat === '低谷' ? 'valley' : 'deep-valley'}">
                                ${avgByCategory[cat].toFixed(4)} 元
                            </span>
                        </div>
                    `).join('')}
                </div>
                <div style="font-size:0.8rem;color:var(--text-muted);">
                    <span>${provPrices.length} 条价格数据 · ${p.data_status === 'verified' ? '✅' : '⚠️'} ${p.data_status === 'verified' ? '数据已验证' : '待验证'}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // ===== 渲染：对比图表 =====
    function renderComparisonChart() {
        const ctx = document.getElementById('comparisonChart').getContext('2d');
        const canvas = document.getElementById('comparisonChart');
        
        // 计算每个省各分类的平均价格
        const categories = ['尖峰', '高峰', '平段', '低谷'];
        const datasets = [];
        
        state.provinces.forEach(p => {
            const provPrices = state.prices.filter(pr => pr.province_id === p.province_id);
            const data = categories.map(cat => {
                const catPrices = provPrices.filter(pr => pr.standard_category === cat);
                if (catPrices.length === 0) return null;
                return catPrices.reduce((sum, pr) => sum + parseFloat(pr.price_yuan_per_kwh), 0) / catPrices.length;
            });
            
            // 检查是否有数据
            if (data.some(v => v !== null)) {
                datasets.push({
                    label: PROVINCE_NAMES[p.province_id],
                    data: data,
                    backgroundColor: PROVINCE_COLORS[p.province_id] + '40',
                    borderColor: PROVINCE_COLORS[p.province_id],
                    borderWidth: 2,
                    borderRadius: 4,
                    barPercentage: 0.7,
                });
            }
        });
        
        if (state.charts.comparison) {
            state.charts.comparison.destroy();
        }
        
        state.charts.comparison = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#94a3b8',
                            padding: 16,
                            usePointStyle: true,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: '#334155',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(4) + ' 元/kWh';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            callback: function(value) { return value.toFixed(2) + ' 元'; }
                        },
                        title: {
                            display: true,
                            text: '电价 (元/kWh)',
                            color: '#64748b'
                        }
                    }
                }
            }
        });
    }

    // ===== 渲染：数据源列表 =====
    function renderDataSources() {
        const container = document.getElementById('sourceList');
        container.innerHTML = '';
        
        state.dataSources.forEach(src => {
            const provinceName = PROVINCE_NAMES[src.province_id] || src.province_id;
            const reliabilityLabel = src.reliability === 'high' ? '高可信度' : src.reliability === 'medium' ? '中可信度' : '低可信度';
            
            let domain = '';
            try {
                domain = new URL(src.source_url).hostname;
            } catch(e) {
                domain = src.source_url;
            }
            
            const item = document.createElement('div');
            item.className = 'source-item';
            item.innerHTML = `
                <div class="source-name">
                    <span class="status-tag ${src.reliability}">${reliabilityLabel}</span>
                    <span style="margin-left:8px;">[${provinceName}] ${src.source_name}</span>
                </div>
                <div class="source-meta">
                    发布: ${src.publish_date || '未知'} · 
                    采集: ${src.collect_date || '未知'} · 
                    类型: ${src.source_type === 'government_doc' ? '政府文件' : '电网公告'}
                </div>
                <div class="source-url" style="margin-top:4px;">
                    <a href="${src.source_url}" target="_blank" rel="noopener noreferrer">
                        🔗 打开 ${domain} 官网首页
                    </a>
                    <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:3px;padding:6px 10px;background:rgba(37,99,235,0.08);border-radius:6px;">
                        📍 查找路径：${src.notes || '首页搜索"分时电价"'}
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    // ===== 渲染：价格数据表 =====
    function renderPriceTable(filters = {}) {
        const tbody = document.getElementById('priceTableBody');
        tbody.innerHTML = '';
        
        let filtered = [...state.prices];
        
        if (filters.province_id && filters.province_id !== 'all') {
            filtered = filtered.filter(p => p.province_id === filters.province_id);
        }
        if (filters.season && filters.season !== 'all') {
            filtered = filtered.filter(p => p.season === filters.season);
        }
        if (filters.standard_category && filters.standard_category !== 'all') {
            filtered = filtered.filter(p => p.standard_category === filters.standard_category);
        }
        
        // 按省份、分类、开始时间排序
        filtered.sort((a, b) => {
            const order = { '尖峰': 0, '高峰': 1, '平段': 2, '低谷': 3, '深谷': 4 };
            const aProv = a.province_id.localeCompare(b.province_id);
            if (aProv !== 0) return aProv;
            const aCat = order[a.standard_category] || 99;
            const bCat = order[b.standard_category] || 99;
            if (aCat !== bCat) return aCat - bCat;
            return a.start_time.localeCompare(b.start_time);
        });
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">暂无匹配数据</td></tr>';
            document.getElementById('tableCount').textContent = '0 条';
            return;
        }
        
        filtered.forEach(p => {
            const seasonLabel = SEASON_LABELS[p.season] || p.season;
            const priceClass = p.standard_category === '尖峰' ? 'sharp-peak' :
                               p.standard_category === '高峰' ? 'peak' :
                               p.standard_category === '平段' ? 'flat' :
                               p.standard_category === '低谷' ? 'valley' : 'deep-valley';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${PROVINCE_NAMES[p.province_id] || p.province_id}</td>
                <td>${seasonLabel}</td>
                <td>${p.standard_category}</td>
                <td>${p.start_time} - ${p.end_time}</td>
                <td><span class="price-tag price-${priceClass}">${parseFloat(p.price_yuan_per_kwh).toFixed(4)}</span></td>
                <td>${p.effective_date}</td>
                <td>${p.source_id}</td>
            `;
            tbody.appendChild(tr);
        });
        
        document.getElementById('tableCount').textContent = filtered.length + ' 条';
    }

    // ===== 渲染：结论 =====
    function renderConclusion() {
        const container = document.getElementById('conclusionText');
        
        // 计算关键对比指标
        const allCats = ['尖峰', '高峰', '平段', '低谷'];
        const provinceAvgs = {};
        
        state.provinces.forEach(p => {
            const provPrices = state.prices.filter(pr => pr.province_id === p.province_id);
            const avgs = {};
            allCats.forEach(cat => {
                const catPrices = provPrices.filter(pr => pr.standard_category === cat);
                if (catPrices.length > 0) {
                    avgs[cat] = catPrices.reduce((sum, pr) => sum + parseFloat(pr.price_yuan_per_kwh), 0) / catPrices.length;
                }
            });
            provinceAvgs[p.province_id] = avgs;
        });
        
        // 找到最高和最低高峰省份
        let maxPeak = { name: '', price: 0 };
        let minPeak = { name: '', price: Infinity };
        Object.entries(provinceAvgs).forEach(([id, avgs]) => {
            if (avgs['高峰'] || avgs['尖峰']) {
                const peakPrice = avgs['尖峰'] || avgs['高峰'];
                if (peakPrice > maxPeak.price) maxPeak = { name: PROVINCE_NAMES[id] || id, price: peakPrice };
                if (peakPrice < minPeak.price) minPeak = { name: PROVINCE_NAMES[id] || id, price: peakPrice };
            }
        });
        
        // 计算峰谷价差
        const priceSpreads = Object.entries(provinceAvgs).map(([id, avgs]) => {
            const peak = avgs['尖峰'] || avgs['高峰'];
            const valley = avgs['低谷'];
            if (peak && valley) {
                return { name: PROVINCE_NAMES[id] || id, spread: peak - valley, ratio: peak / valley };
            }
            return null;
        }).filter(Boolean);
        
        priceSpreads.sort((a, b) => b.spread - a.spread);
        
        const conclusion = `
            5 省一般工商业（1-10kV）分时电价对比显示：<strong>${maxPeak.name}</strong>高峰时段电价最高（约 ${maxPeak.price.toFixed(2)} 元/kWh），
            <strong>${minPeak.name}</strong>最低（约 ${minPeak.price.toFixed(2)} 元/kWh）。
            峰谷价差最大的是<strong>${priceSpreads[0]?.name || 'N/A'}</strong>（价差约 ${priceSpreads[0]?.spread.toFixed(4) || 'N/A'} 元/kWh，峰谷比约 ${priceSpreads[0]?.ratio.toFixed(2) || 'N/A'}:1），
            反映该省份电价调节力度较大。广东省在夏季增设尖峰时段（11-12时、15-17时），电价高达 1.17 元/kWh，为5省最高。
            所有省份均设置了夜间低谷时段（22:00-次日6:00或8:00），低谷电价集中在 0.28-0.34 元/kWh 区间。
            各省时段划分标准差异明显，反映了不同地区电力负荷特性差异。
        `;
        
        container.innerHTML = conclusion;
    }

    // ===== 渲染：数据源表格 =====
    function renderSourceTable() {
        const tbody = document.getElementById('sourceTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        state.dataSources.forEach(src => {
            let domain = '';
            try {
                domain = new URL(src.source_url).hostname;
            } catch(e) {
                domain = src.source_url;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${PROVINCE_NAMES[src.province_id] || src.province_id}</td>
                <td>${src.source_name}</td>
                <td>${src.source_type === 'government_doc' ? '政府文件' : '电网公告'}</td>
                <td><span class="status-tag ${src.reliability}">${src.reliability === 'high' ? '高' : src.reliability === 'medium' ? '中' : '低'}</span></td>
                <td style="max-width:220px;">
                    <a href="${src.source_url}" target="_blank" class="source-link">打开官网</a>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px;line-height:1.4;">
                        ${src.notes ? src.notes.substring(0, 60) + '...' : '站内搜索"分时电价"'}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ===== 渲染：缺失数据说明 =====
    function renderMissingDataNotes() {
        const container = document.getElementById('missingDataNotes');
        container.innerHTML = '';
        
        const notes = [
            { province: '浙江省', issue: '未区分季节时段，全年使用统一分时方案', type: 'info' },
            { province: '江苏省', issue: '未区分季节时段，全年使用统一分时方案', type: 'info' },
            { province: '内蒙古', issue: '仅包含蒙西地区数据，蒙东地区政策待补充', type: 'warning' },
            { province: '山东省', issue: '未获取春季和秋季独立时段数据（可能与冬夏季相同），深谷时段数据待核实', type: 'warning' },
            { province: '全部', issue: '本版本仅涵盖一般工商业1-10kV用户类型，大工业及其他电压等级数据待补充', type: 'info' },
        ];
        
        notes.forEach(n => {
            const note = document.createElement('div');
            note.className = 'missing-notice';
            note.innerHTML = `
                <span class="icon">${n.type === 'warning' ? '⚠️' : '📌'}</span>
                <div>
                    <strong>${n.province}</strong>：${n.issue}
                </div>
            `;
            container.appendChild(note);
        });
    }

    // ===== 事件绑定 =====
    function bindEvents() {
        // 省份筛选
        document.getElementById('selectProvince').addEventListener('change', function() {
            state.selectedProvince = this.value;
            const seasonSelect = document.getElementById('selectSeason');
            // 根据省份更新季节选项
            updatePriceTable();
            updateProvinceHighlight();
        });
        
        // 季节筛选
        document.getElementById('selectSeason').addEventListener('change', function() {
            state.selectedSeason = this.value;
            updatePriceTable();
        });
        
        // 时段分类筛选
        document.getElementById('selectCategory').addEventListener('change', function() {
            state.selectedCategory = this.value;
            updatePriceTable();
        });
        
        // Tab 切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tabId = this.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                document.getElementById(tabId + 'Tab').classList.add('active');
            });
        });
    }

    // ===== 更新价格表 =====
    function updatePriceTable() {
        renderPriceTable({
            province_id: state.selectedProvince,
            season: state.selectedSeason,
            standard_category: state.selectedCategory
        });
    }

    // ===== 省份高亮 =====
    function updateProvinceHighlight() {
        document.querySelectorAll('#provinceCards .card').forEach(card => {
            const province = card.dataset.province;
            if (state.selectedProvince === 'all' || state.selectedProvince === province) {
                card.style.borderColor = PROVINCE_COLORS[province] || 'var(--border-color)';
                card.style.boxShadow = `0 0 15px ${PROVINCE_COLORS[province]}20`;
            } else {
                card.style.borderColor = 'var(--border-color)';
                card.style.boxShadow = 'none';
                card.style.opacity = '0.5';
            }
        });
    }

    // ===== 工具函数 =====
    function showLoading(show) {
        document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
    }

    function showError(msg) {
        const container = document.getElementById('errorDisplay');
        if (container) {
            container.innerHTML = `<div class="missing-notice" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);">
                <span class="icon">❌</span>
                <div><strong>错误</strong>：${msg}</div>
            </div>`;
            container.style.display = 'block';
        }
    }

    // ===== 启动 =====
    document.addEventListener('DOMContentLoaded', init);
})();
