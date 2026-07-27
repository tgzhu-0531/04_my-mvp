/**
 * 城市分时电价观察站 - MVP
 * JavaScript 应用逻辑
 */

const API_BASE = window.location.origin;
let allCities = [];
let allPrices = [];

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    setupNavigation();
    setupCharts();
    setupPeriodSelector();
});

async function loadInitialData() {
    try {
        const [citiesRes, statsRes] = await Promise.all([
            fetch(`${API_BASE}/api/cities`),
            fetch(`${API_BASE}/api/stats`)
        ]);
        const citiesData = await citiesRes.json();
        const stats = await statsRes.json();
        allCities = citiesData.cities;
        
        renderStats(stats);
        renderCityGrid(allCities);
        renderCitySelects(allCities);
        renderCompareCheckboxes(allCities);
        updateCityCount(allCities.length);
    } catch (e) {
        console.error('加载初始数据失败:', e);
        document.querySelector('#stats-grid').innerHTML = 
            '<div class="empty-state">⚠️ 数据加载失败，请确认后端服务已启动</div>';
    }
}

// ==================== 导航 ====================
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
    document.querySelector(`#tab-${tab}`).classList.add('active');
    
    // 切换时刷新图表
    if (tab === 'dashboard') setupCharts();
    if (tab === 'sources') loadSources();
    if (tab === 'compare') initializeCompare();
}

// ==================== 统计概览 ====================
function renderStats(stats) {
    const grid = document.querySelector('#stats-grid');
    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.city_count}</div>
            <div class="stat-label">🏙️ 覆盖城市</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.province_count}</div>
            <div class="stat-label">🗺️ 覆盖省份</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.record_count}</div>
            <div class="stat-label">📊 电价记录</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.source_count}</div>
            <div class="stat-label">📋 数据来源</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.highest_peak ? '↑' : '—'}</div>
            <div class="stat-label">
                ${stats.highest_peak ? 
                    `最高峰值: ${stats.highest_peak.name} ${stats.highest_peak.price_per_kwh}元` : 
                    '暂无数据'}
            </div>
        </div>
    `;
}

// ==================== 城市网格 ====================
function renderCityGrid(cities) {
    const grid = document.querySelector('#city-grid');
    grid.innerHTML = cities.map(c => `
        <div class="city-card" onclick="queryCity(${c.id}, '${c.name}')">
            <div class="city-name">${c.name}</div>
            <div class="city-province">${c.province} · ${c.region}</div>
            <div class="city-grid-company">${c.grid_company}</div>
        </div>
    `).join('');
}

function queryCity(cityId, cityName) {
    switchTab('query');
    document.querySelector('#query-city').value = cityId;
    queryPrices();
}

function updateCityCount(count) {
    document.querySelector('#city-count-badge').textContent = `${count} 个城市`;
}

// ==================== 下拉选择 ====================
function renderCitySelects(cities) {
    const options = cities.map(c => 
        `<option value="${c.id}">${c.name} (${c.province})</option>`
    ).join('');
    
    document.querySelector('#query-city').innerHTML = 
        `<option value="">全部城市</option>` + options;
    document.querySelector('#period-city').innerHTML = 
        `<option value="">请选择城市</option>` + options;
}

function renderCompareCheckboxes(cities) {
    const container = document.querySelector('#compare-cities');
    container.innerHTML = cities.map(c => `
        <label>
            <input type="checkbox" value="${c.id}" data-name="${c.name}">
            <span>${c.name}</span>
        </label>
    `).join('');
}

// ==================== 电价查询 ====================
async function queryPrices() {
    const cityId = document.querySelector('#query-city').value;
    const period = document.querySelector('#query-period').value;
    const voltage = document.querySelector('#query-voltage').value;
    
    let url = `${API_BASE}/api/prices?voltage=${voltage}`;
    if (cityId) url += `&city_id=${cityId}`;
    if (period) url += `&period=${period}`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        renderPriceTable(data.prices);
    } catch (e) {
        console.error('查询失败:', e);
    }
}

function renderPriceTable(prices) {
    const tbody = document.querySelector('#query-results');
    if (!prices.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">未找到匹配的电价数据</td></tr>';
        return;
    }
    tbody.innerHTML = prices.map(p => `
        <tr>
            <td><strong>${p.city_name}</strong></td>
            <td>${p.province}</td>
            <td>${p.region}</td>
            <td><span class="badge">${p.period_name}</span></td>
            <td><strong>${p.price_per_kwh.toFixed(4)}</strong></td>
            <td>${p.voltage_level}</td>
            <td>${p.effective_date}</td>
            <td><a href="${p.source_url || '#'}" target="_blank" class="source-link">${p.source_name || '—'}</a></td>
        </tr>
    `).join('');
}

function resetQuery() {
    document.querySelector('#query-city').value = '';
    document.querySelector('#query-period').value = '';
    document.querySelector('#query-results').innerHTML = 
        '<tr><td colspan="8" class="empty-state">选择条件后点击查询</td></tr>';
}

// ==================== 分时时段 ====================
function setupPeriodSelector() {
    document.querySelector('#period-city').addEventListener('change', async (e) => {
        const cityId = e.target.value;
        if (!cityId) {
            document.querySelector('#period-table-wrapper').innerHTML = '<p class="empty-state">请先选择城市</p>';
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/price-periods/${cityId}`);
            const data = await res.json();
            renderPeriodTable(data.periods);
        } catch (e) {
            console.error('加载时段失败:', e);
        }
    });
}

function renderPeriodTable(periods) {
    if (!periods.length) {
        document.querySelector('#period-table-wrapper').innerHTML = '<p class="empty-state">暂无时段定义</p>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr><th>时段名称</th><th>季节</th><th>起始时间</th><th>结束时间</th></tr></thead><tbody>';
    periods.forEach(p => {
        html += `<tr>
            <td><span class="badge">${p.period_name}</span></td>
            <td>${p.season}</td>
            <td>${p.start_time}</td>
            <td>${p.end_time}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    document.querySelector('#period-table-wrapper').innerHTML = html;
}

// ==================== 图表 ====================
let compareChart = null;
let trendChart = null;

function setupCharts() {
    renderCompareChart();
    renderTrendSelector();
    renderTrendChart();
}

async function renderCompareChart() {
    const chartDom = document.querySelector('#chart-compare');
    if (!chartDom) return;
    if (compareChart) compareChart.dispose();
    compareChart = echarts.init(chartDom);
    
    try {
        const res = await fetch(`${API_BASE}/api/prices?period=高峰&voltage=1-10kV`);
        const data = await res.json();
        
        const cities = data.prices.map(p => p.city_name);
        const prices = data.prices.map(p => p.price_per_kwh);
        const colors = prices.map(p => {
            if (p > 1.0) return '#ea4335';
            if (p > 0.8) return '#f9ab00';
            return '#34a853';
        });
        
        compareChart.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '15%', top: '8%', containLabel: true },
            xAxis: { type: 'category', data: cities, axisLabel: { rotate: 30, fontSize: 11 } },
            yAxis: { type: 'value', name: '元/kWh', nameTextStyle: { fontSize: 11 } },
            series: [{
                type: 'bar',
                data: prices.map((v, i) => ({
                    value: v,
                    itemStyle: { color: colors[i], borderRadius: [4, 4, 0, 0] }
                })),
                barWidth: '50%',
                label: {
                    show: true,
                    position: 'top',
                    formatter: (p) => p.value.toFixed(4),
                    fontSize: 10
                }
            }]
        });
        window.addEventListener('resize', () => compareChart.resize());
    } catch (e) {
        chartDom.innerHTML = '<div class="empty-state">加载图表数据失败</div>';
    }
}

function renderTrendSelector() {
    const select = document.querySelector('#trend-city-select');
    if (!select) return;
    // 只显示有趋势数据的城市
    const trendCities = ['北京', '上海', '广州'];
    select.innerHTML = trendCities.map(c => {
        const city = allCities.find(ci => ci.name === c);
        return city ? `<option value="${city.id}">${c}</option>` : '';
    }).join('');
    select.addEventListener('change', renderTrendChart);
}

async function renderTrendChart() {
    const chartDom = document.querySelector('#chart-trend');
    if (!chartDom) return;
    const cityId = document.querySelector('#trend-city-select')?.value;
    if (!cityId) return;
    
    if (trendChart) trendChart.dispose();
    trendChart = echarts.init(chartDom);
    
    try {
        const res = await fetch(`${API_BASE}/api/trends/${cityId}`);
        const data = await res.json();
        const trends = data.trends;
        
        const years = trends.map(t => t.year);
        
        trendChart.setOption({
            tooltip: { trigger: 'axis' },
            legend: { data: ['尖峰', '高峰', '平段', '低谷'], bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '20%', top: '8%', containLabel: true },
            xAxis: { type: 'category', data: years },
            yAxis: { type: 'value', name: '元/kWh' },
            series: [
                { name: '尖峰', type: 'line', data: trends.map(t => t.spike_price), smooth: true, 
                  lineStyle: { color: '#d32f2f', width: 2 }, symbol: 'circle' },
                { name: '高峰', type: 'line', data: trends.map(t => t.peak_price), smooth: true,
                  lineStyle: { color: '#f57c00', width: 2 }, symbol: 'diamond' },
                { name: '平段', type: 'line', data: trends.map(t => t.flat_price), smooth: true,
                  lineStyle: { color: '#1976d2', width: 2 }, symbol: 'triangle' },
                { name: '低谷', type: 'line', data: trends.map(t => t.valley_price), smooth: true,
                  lineStyle: { color: '#388e3c', width: 2 }, symbol: 'rect' }
            ]
        });
        window.addEventListener('resize', () => trendChart.resize());
    } catch (e) {
        chartDom.innerHTML = '<div class="empty-state">暂无趋势数据</div>';
    }
}

// ==================== 对比功能 ====================
async function initializeCompare() {
    // 默认选中前几个城市
    const checkboxes = document.querySelectorAll('#compare-cities input');
    checkboxes.forEach((cb, i) => {
        cb.checked = i < 3;
    });
    await comparePrices();
}

async function comparePrices() {
    const checked = document.querySelectorAll('#compare-cities input:checked');
    if (checked.length < 2) {
        alert('请至少选择2个城市进行比较');
        return;
    }
    const cityIds = Array.from(checked).map(cb => cb.value).join(',');
    
    try {
        const res = await fetch(`${API_BASE}/api/prices/compare?cities=${cityIds}`);
        const data = await res.json();
        renderCompareChart(data.comparison);
        renderCompareTable(data.comparison);
    } catch (e) {
        console.error('对比失败:', e);
    }
}

function renderCompareChart(prices) {
    const chartDom = document.querySelector('#chart-compare-detail');
    if (!chartDom) return;
    
    // 整理数据：按城市分组
    const cityMap = {};
    prices.forEach(p => {
        if (!cityMap[p.city_name]) cityMap[p.city_name] = {};
        cityMap[p.city_name][p.period_name] = p.price_per_kwh;
    });
    
    const cities = Object.keys(cityMap);
    const periods = ['尖峰', '高峰', '平段', '低谷'];
    const colors = { '尖峰': '#d32f2f', '高峰': '#f57c00', '平段': '#1976d2', '低谷': '#388e3c' };
    
    let myChart = echarts.getInstanceByDom(chartDom);
    if (myChart) myChart.dispose();
    myChart = echarts.init(chartDom);
    
    // 分组柱状图
    const series = periods.map(p => ({
        name: p,
        type: 'bar',
        barWidth: '18%',
        data: cities.map(c => cityMap[c][p] || 0),
        itemStyle: { color: colors[p], borderRadius: [3, 3, 0, 0] }
    }));
    
    myChart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: periods, bottom: 0 },
        grid: { left: '3%', right: '4%', bottom: '20%', top: '8%', containLabel: true },
        xAxis: { type: 'category', data: cities },
        yAxis: { type: 'value', name: '元/kWh' },
        series: series
    });
    window.addEventListener('resize', () => myChart.resize());
}

function renderCompareTable(prices) {
    // 整理数据
    const cityMap = {};
    prices.forEach(p => {
        if (!cityMap[p.city_name]) {
            cityMap[p.city_name] = {
                city_name: p.city_name,
                province: p.province,
                region: p.region,
                periods: {}
            };
        }
        cityMap[p.city_name].periods[p.period_name] = p.price_per_kwh;
    });
    
    const tbody = document.querySelector('#compare-results');
    const html = Object.values(cityMap).map(c => {
        const peak = c.periods['高峰'] || 0;
        const valley = c.periods['低谷'] || 0;
        const spread = peak - valley;
        return `<tr>
            <td><strong>${c.city_name}</strong><br><span style="font-size:11px;color:var(--text-secondary)">${c.province}</span></td>
            <td>${c.periods['尖峰'] ? c.periods['尖峰'].toFixed(4) : '—'}</td>
            <td>${peak ? peak.toFixed(4) : '—'}</td>
            <td>${c.periods['平段'] ? c.periods['平段'].toFixed(4) : '—'}</td>
            <td>${valley ? valley.toFixed(4) : '—'}</td>
            <td><strong>${spread > 0 ? spread.toFixed(4) : '—'}</strong></td>
        </tr>`;
    }).join('');
    tbody.innerHTML = html;
}

// ==================== 数据来源 ====================
async function loadSources() {
    try {
        const res = await fetch(`${API_BASE}/api/sources`);
        const data = await res.json();
        renderSources(data.sources);
    } catch (e) {
        document.querySelector('#sources-results').innerHTML = 
            '<tr><td colspan="6" class="empty-state">加载失败</td></tr>';
    }
}

function renderSources(sources) {
    const tbody = document.querySelector('#sources-results');
    tbody.innerHTML = sources.map(s => {
        const dots = Array(5).fill(0).map((_, i) => 
            `<span class="dot ${i < s.reliability_score ? 'active' : 'inactive'}"></span>`
        ).join('');
        return `<tr>
            <td><strong>${s.source_name}</strong></td>
            <td><span class="badge">${s.source_type}</span></td>
            <td><span class="reliability-dots">${dots}</span></td>
            <td>${s.url ? `<a href="${s.url}" target="_blank" class="source-link">🔗 访问</a>` : '—'}</td>
            <td>${s.used_count}</td>
            <td>${s.retrieval_date || '—'}</td>
        </tr>`;
    }).join('');
}
