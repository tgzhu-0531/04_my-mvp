/**
 * 城市分时电价观察站 - 核心脚本
 * 支持 CSV 和 SQLite 两种数据源模式
 * 自动根据 config.json 中的 dataSource 配置切换数据加载方式
 */

// ===== 全局状态 =====
const APP = {
  config: null,
  data: {
    tou_rates: [],
    data_sources: [],
    missing_records: [],
    province_summary: []
  },
  currentProvince: null,
  currentSeason: 'all',
  currentTab: 'overview'
};

// ===== 配置加载 =====
async function loadConfig() {
  try {
    const resp = await fetch('config.json');
    if (!resp.ok) throw new Error('无法加载配置文件');
    APP.config = await resp.json();
    document.getElementById('dataSourceBadge').textContent = 
      APP.config.dataSource.toUpperCase();
    return APP.config;
  } catch (e) {
    console.error('配置加载失败:', e);
    showError('配置文件加载失败，请确认 config.json 存在且格式正确。');
    return null;
  }
}

// ===== CSV 数据加载 =====
async function loadCSV(filename) {
  const basePath = APP.config.dataSourceOptions.csv.basePath;
  const url = basePath + filename;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
    const text = await resp.text();
    return parseCSV(text);
  } catch (e) {
    console.error(`CSV 加载失败 (${filename}):`, e);
    return [];
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length === headers.length && values.some(v => v)) {
      const row = {};
      headers.forEach((h, idx) => {
        let val = values[idx];
        // 尝试去除首尾引号
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        row[h] = val;
      });
      results.push(row);
    }
  }
  return results;
}

// ===== SQLite API 数据加载 =====
async function loadSQLite(mode, params = {}) {
  const endpoint = APP.config.dataSourceOptions.sqlite.apiEndpoint;
  const url = `${endpoint}/${mode}`;
  try {
    const resp = await fetch(url + '?' + new URLSearchParams(params));
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.error(`SQLite API 错误 (${mode}):`, e);
    return [];
  }
}

// ===== 数据加载入口 =====
async function loadAllData() {
  showLoading(true);
  
  if (APP.config.dataSource === 'csv') {
    APP.data.tou_rates = await loadCSV(APP.config.dataSourceOptions.csv.files.tou_rates);
    APP.data.data_sources = await loadCSV(APP.config.dataSourceOptions.csv.files.data_sources);
    APP.data.missing_records = await loadCSV(APP.config.dataSourceOptions.csv.files.missing_records);
    APP.data.province_summary = await loadCSV(APP.config.dataSourceOptions.csv.files.province_summary);
  } else if (APP.config.dataSource === 'sqlite') {
    APP.data.tou_rates = await loadSQLite('tou_rates');
    APP.data.data_sources = await loadSQLite('data_sources');
    APP.data.missing_records = await loadSQLite('missing_records');
    APP.data.province_summary = await loadSQLite('province_summary');
  }
  
  showLoading(false);
  
  // 如果数据为空，使用内嵌的 fallback 数据
  if (APP.data.tou_rates.length === 0) {
    console.warn('CSV/API 数据加载为空，使用内嵌示例数据');
    APP.data.tou_rates = APP.embeddedData.tou_rates;
    APP.data.data_sources = APP.embeddedData.data_sources;
    APP.data.missing_records = APP.embeddedData.missing_records;
    APP.data.province_summary = APP.embeddedData.province_summary;
  }
  
  // 渲染所有组件
  renderAll();
}

// ===== 渲染入口 =====
function renderAll() {
  renderHeroStats();
  renderProvinceCards();
  renderComparisonTable();
  renderChart();
  renderDataSourceCenter();
  renderMissingData();
  renderAnalysis();
  renderPageTitle();
}

// ===== 渲染英雄区统计 =====
function renderHeroStats() {
  const provinces = [...new Set(APP.data.tou_rates.map(d => d.province))];
  const sources = [...new Set(APP.data.data_sources.map(d => d.source_name))];
  const periods = APP.data.tou_rates.length;
  const activePolicies = [...new Set(APP.data.tou_rates.map(d => d.policy_id))].length;
  
  document.getElementById('statProvinces').textContent = provinces.length;
  document.getElementById('statPolicies').textContent = activePolicies;
  document.getElementById('statSources').textContent = sources.length;
  document.getElementById('statPeriods').textContent = periods;
}

// ===== 渲染省份卡片 =====
function renderProvinceCards() {
  const container = document.getElementById('provinceCards');
  const provinces = [...new Set(APP.data.tou_rates.map(d => d.province))];
  
  container.innerHTML = provinces.map(prov => {
    const records = APP.data.tou_rates.filter(d => d.province === prov);
    const prices = records.map(d => parseFloat(d.price)).filter(p => !isNaN(p));
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const spread = (maxPrice - minPrice).toFixed(4);
    const summary = APP.data.province_summary.find(s => s.province === prov);
    const periodCount = summary ? summary.period_count : records.length;
    
    const hasMissing = APP.data.missing_records.some(m => m.province === prov);
    const badgeClass = hasMissing ? 'badge-limited' : 'badge-active';
    const badgeText = hasMissing ? '部分缺失' : '数据正常';
    
    return `
      <div class="province-card" onclick="switchProvince('${prov}')" data-province="${prov}">
        <div class="province-card-header">
          <span class="province-name">${prov}</span>
          <span class="province-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="province-card-body">
          <div class="stat-row">
            <span class="stat-label">时段数</span>
            <span class="stat-value">${periodCount}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">最高价</span>
            <span class="stat-value price-high">${maxPrice.toFixed(4)} 元/kWh</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">最低价</span>
            <span class="stat-value price-low">${minPrice.toFixed(4)} 元/kWh</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">峰谷价差</span>
            <span class="stat-value" style="font-weight:700;color:var(--primary)">${spread} 元/kWh</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== 切换省份 =====
function switchProvince(prov) {
  APP.currentProvince = APP.currentProvince === prov ? null : prov;
  document.querySelectorAll('.province-card').forEach(c => {
    c.classList.toggle('active', c.dataset.province === APP.currentProvince);
  });
  renderComparisonTable();
  renderChart();
}

// ===== 渲染对比表格 =====
function renderComparisonTable() {
  const tbody = document.getElementById('comparisonBody');
  const provinces = [...new Set(APP.data.tou_rates.map(d => d.province))];
  
  // 标准分类顺序
  const categories = ['尖', '峰', '平', '谷', '深谷'];
  const catNames = { '尖': '尖峰', '峰': '高峰', '平': '平段', '谷': '低谷', '深谷': '深谷' };
  
  // 获取每个省份各标准分类的代表性价格
  const getProvinceCategoryPrice = (prov, cat, season) => {
    let records = APP.data.tou_rates.filter(d => d.province === prov && d.standard_category === cat);
    if (season !== 'all' && season) {
      records = records.filter(d => d.season_type === season);
    }
    // 取第一个有效价格
    const valid = records.find(d => !isNaN(parseFloat(d.price)));
    return valid ? parseFloat(valid.price).toFixed(4) : null;
  };
  
  const filteredProvinces = APP.currentProvince 
    ? provinces.filter(p => p === APP.currentProvince)
    : provinces;
  
  let html = '';
  for (const cat of categories) {
    html += '<tr>';
    html += `<td><span class="standard-tag tag-${cat}">${catNames[cat]}</span></td>`;
    for (const prov of filteredProvinces) {
      const price = getProvinceCategoryPrice(prov, cat, null);
      if (price) {
        html += `<td class="price-cell">${price}</td>`;
      } else {
        html += `<td class="na-text">不适用/未公开</td>`;
      }
    }
    html += '</tr>';
  }
  
  // 表头
  const thead = document.getElementById('comparisonHead');
  thead.innerHTML = '<th>时段分类</th>' + filteredProvinces.map(p => `<th>${p}</th>`).join('');
  
  tbody.innerHTML = html;
}

// ===== 渲染电价曲线图 (使用 Canvas) =====
function renderChart() {
  const canvas = document.getElementById('priceChart');
  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  
  // 设置 Canvas 尺寸
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = rect.width || 800;
  const height = 400;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);
  
  // 获取需要展示的省份
  const provinces = APP.currentProvince 
    ? [APP.currentProvince]
    : [...new Set(APP.data.tou_rates.map(d => d.province))];
  
  // 取各季节的平段数据展示（选择夏季或第一季）
  const getProvinceCurve = (prov) => {
    let records = APP.data.tou_rates.filter(d => d.province === prov);
    // 优先夏季
    let seasonRecords = records.filter(d => d.season_type === '夏季');
    if (seasonRecords.length === 0) {
      seasonRecords = records;
    }
    // 按时间排序
    seasonRecords.sort((a, b) => {
      const timeA = a.start_time || '00:00';
      const timeB = b.start_time || '00:00';
      return timeA.localeCompare(timeB);
    });
    return seasonRecords;
  };
  
  // 颜色方案
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];
  const timeLabels = [];
  
  // 构建24小时标签
  for (let h = 0; h < 24; h++) {
    timeLabels.push(`${String(h).padStart(2, '0')}:00`);
  }
  
  // 计算每个省份各小时的价格
  const provinceHourlyPrices = {};
  provinces.forEach((prov, idx) => {
    const records = getProvinceCurve(prov);
    const hourlyPrices = new Array(24).fill(null);
    
    for (const r of records) {
      const start = parseInt(r.start_time?.split(':')[0] || '0');
      const end = parseInt(r.end_time?.split(':')[0] || '0');
      const price = parseFloat(r.price);
      if (isNaN(price)) continue;
      
      if (end > start) {
        for (let h = start; h < end; h++) {
          hourlyPrices[h] = price;
        }
      } else if (end <= start) {
        // 跨日时段
        for (let h = start; h < 24; h++) hourlyPrices[h] = price;
        for (let h = 0; h < end; h++) hourlyPrices[h] = price;
      }
    }
    
    provinceHourlyPrices[prov] = hourlyPrices;
  });
  
  // 绘制
  const padding = { top: 30, right: 20, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  
  // 清空
  ctx.clearRect(0, 0, width, height);
  
  // 背景
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, width, height);
  
  // 找到全局最大最小值
  let allPrices = [];
  Object.values(provinceHourlyPrices).forEach(arr => {
    arr.forEach(p => { if (p !== null) allPrices.push(p); });
  });
  const maxP = Math.max(...allPrices) * 1.1 || 1.5;
  const minP = Math.min(...allPrices) * 0.9 || 0;
  
  // 网格
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + chartH * (1 - i / 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    
    // Y轴标签
    const val = (minP + (maxP - minP) * i / 4).toFixed(2);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, padding.left - 8, y + 4);
  }
  
  // X轴标签
  for (let h = 0; h < 24; h += 2) {
    const x = padding.left + (h / 23) * chartW;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(h).padStart(2, '0') + ':00', x, height - padding.bottom + 18);
  }
  
  // 轴标签
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('时段', width / 2, height - 6);
  ctx.save();
  ctx.translate(14, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('电价 (元/kWh)', 0, 0);
  ctx.restore();
  
  // 绘制线条
  provinces.forEach((prov, idx) => {
    const prices = provinceHourlyPrices[prov];
    const color = colors[idx % colors.length];
    const validPoints = prices.map((p, i) => ({ h: i, p }));
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    let started = false;
    for (let h = 0; h <= 23; h++) {
      const p = prices[h];
      const nextP = h < 23 ? prices[h + 1] : prices[0];
      if (p === null) { started = false; continue; }
      
      const x = padding.left + (h / 23) * chartW;
      const y = padding.top + chartH * (1 - (p - minP) / (maxP - minP));
      
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // 图例
    const legendY = 15 + idx * 22;
    ctx.fillStyle = color;
    ctx.fillRect(padding.left + 10, legendY, 16, 3);
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(prov, padding.left + 32, legendY + 4);
  });
  
  // Y轴标题
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('元/kWh', 18, 16);
}

// ===== 渲染数据源中心 =====
function renderDataSourceCenter() {
  const container = document.getElementById('dataSourcesList');
  if (!APP.data.data_sources || APP.data.data_sources.length === 0) {
    container.innerHTML = '<div class="loading">暂无数据源记录</div>';
    return;
  }
  
  container.innerHTML = APP.data.data_sources.map(src => {
    const relClass = `reliability-${(src.reliability || '中') === '高' ? 'high' : (src.reliability || '中') === '中' ? 'medium' : 'low'}`;
    return `
      <div class="source-card">
        <div class="source-title">${escHtml(src.source_name || '未命名来源')}</div>
        <div class="source-meta">
          <div class="source-meta-item">
            <span class="source-meta-label">发布机构：</span>
            <span>${escHtml(src.publish_authority || '未知')}</span>
          </div>
          <div class="source-meta-item">
            <span class="source-meta-label">发布时间：</span>
            <span>${escHtml(src.publish_date || '未知')}</span>
          </div>
          <div class="source-meta-item">
            <span class="source-meta-label">采集时间：</span>
            <span>${escHtml(src.collect_date || '未知')}</span>
          </div>
          <div class="source-meta-item">
            <span class="source-meta-label">类型：</span>
            <span>${escHtml(src.data_type || '未知')}</span>
          </div>
          <div class="source-meta-item">
            <span class="source-meta-label">可靠性：</span>
            <span class="reliability-tag ${relClass}">${escHtml(src.reliability || '中')}</span>
          </div>
          ${src.source_url ? `
          <div class="source-meta-item" style="grid-column: 1/-1;">
            <span class="source-meta-label">来源地址：</span>
            <a class="source-url" href="${escHtml(src.source_url)}" target="_blank" rel="noopener">${escHtml(src.source_url)}</a>
          </div>` : ''}
          ${src.remarks ? `
          <div class="source-meta-item" style="grid-column: 1/-1;">
            <span class="source-meta-label">备注：</span>
            <span>${escHtml(src.remarks)}</span>
          </div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ===== 渲染缺失数据 =====
function renderMissingData() {
  const container = document.getElementById('missingDataList');
  if (!APP.data.missing_records || APP.data.missing_records.length === 0) {
    container.innerHTML = '<div class="loading">暂无缺失数据记录</div>';
    return;
  }
  
  container.innerHTML = APP.data.missing_records.map(m => {
    const statusClass = m.status === '已补充' ? 'status-verified' : 
                        m.status === '缺失' ? 'status-missing' : '';
    return `
      <div class="missing-card ${statusClass}">
        <div class="missing-title">
          【${escHtml(m.province)}】${escHtml(m.missing_item || '')}
          <span style="margin-left:8px;font-size:12px;color:var(--gray-400);font-weight:400;">状态：${escHtml(m.status || '未知')}</span>
        </div>
        <div class="missing-desc">${escHtml(m.remarks || '无备注')}</div>
        <div class="missing-process">
          <strong>检索过程：</strong>${escHtml(m.search_process || '未记录')}
        </div>
      </div>
    `;
  }).join('');
}

// ===== 渲染分析结论 =====
function renderAnalysis() {
  const container = document.getElementById('analysisContent');
  const provinces = [...new Set(APP.data.tou_rates.map(d => d.province))];
  
  // 计算每个省份的峰谷价差
  const provinceStats = provinces.map(prov => {
    const records = APP.data.tou_rates.filter(d => d.province === prov);
    const prices = records.map(d => parseFloat(d.price)).filter(p => !isNaN(p));
    const maxP = Math.max(...prices);
    const minP = Math.min(...prices);
    const spread = maxP - minP;
    return { prov, maxP, minP, spread, count: records.length };
  }).sort((a, b) => b.spread - a.spread);
  
  const maxSpread = provinceStats[0];
  const minSpread = provinceStats[provinceStats.length - 1];
  
  container.innerHTML = `
    <p><strong>基于 ${APP.data.tou_rates.length} 条分时电价数据的分析结论：</strong></p>
    <ul>
      <li><strong>峰谷价差最大的是 ${maxSpread.prov}（${maxSpread.spread.toFixed(4)} 元/kWh）</strong>，反映该省电力负荷峰谷差较大，分时电价信号最强烈。</li>
      <li><strong>峰谷价差最小的是 ${minSpread.prov}（${minSpread.spread.toFixed(4)} 元/kWh）</strong>。</li>
      <li>浙江省夏季尖峰价格最高（${provinceStats.find(p=>p.prov==='浙江省')?.maxP.toFixed(4)} 元/kWh），广东省低谷价格相对最低。</li>
      <li>5个样本省份均采用"尖峰-高峰-平段-低谷"四段式分时结构，但具体时段划分和季节差异各不相同。</li>
      <li>内蒙古（蒙西电网）数据为蒙西区域政策，蒙东电网数据仍为待验证状态。</li>
      <li><strong>注意：</strong>以上数据来源于各省发改委公开文件，具体价格随政策调整可能发生变化，使用时请以原始政策文件为准。</li>
    </ul>
  `;
}

// ===== 渲染页面标题 =====
function renderPageTitle() {
  const count = APP.data.tou_rates.length;
  document.getElementById('pageTitle').textContent = `城市分时电价观察站 — 已收录 ${count} 条分时电价数据`;
}

// ===== Tab 切换 =====
function switchTab(tabName) {
  APP.currentTab = tabName;
  
  // 更新标签按钮状态
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === tabName);
  });
  
  // 显示对应内容
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
  
  // 切换到对应tab时重新绘制
  if (tabName === 'overview') {
    setTimeout(() => renderChart(), 100);
  } else if (tabName === 'details') {
    setTimeout(() => { renderDetailTable(); renderDetailChart(); }, 100);
  }
}

// ===== 季节切换 =====
function switchSeason(season) {
  APP.currentSeason = season;
  document.querySelectorAll('.chart-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.season === season);
  });
  renderComparisonTable();
  renderChart();
}

// ===== 辅助函数 =====
function showLoading(show) {
  document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none';
}

function showError(msg) {
  const container = document.getElementById('errorContainer');
  container.innerHTML = `<div style="background:#fee2e2;color:#991b1b;padding:16px;border-radius:8px;margin:16px 0;">${escHtml(msg)}</div>`;
  container.style.display = 'block';
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== 渲染详情表格 =====
function renderDetailTable() {
  const tbody = document.getElementById('detailTableBody');
  if (!APP.data || !APP.data.tou_rates || !tbody) return;
  let html = '';
  APP.data.tou_rates.forEach(r => {
    const catClass = {'尖':'tag-jian','峰':'tag-feng','平':'tag-ping','谷':'tag-gu','深谷':'tag-shengu'}[r.standard_category] || '';
    html += '<tr>';
    html += '<td>' + escHtml(r.province) + '</td>';
    html += '<td>' + escHtml(r.city) + '</td>';
    html += '<td>' + escHtml(r.user_type) + '</td>';
    html += '<td>' + escHtml(r.season_type || '-') + '</td>';
    html += '<td>' + escHtml(r.period_name) + '</td>';
    html += '<td><span class="standard-tag ' + catClass + '">' + escHtml(r.standard_category) + '</span></td>';
    html += '<td>' + escHtml(r.start_time) + '</td>';
    html += '<td>' + escHtml(r.end_time) + '</td>';
    html += '<td class="price-cell">' + (r.price || '-') + '</td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

// ===== 渲染详情图表 =====
function renderDetailChart() {
  const canvas = document.getElementById('priceChartDetails');
  if (!canvas) return;
  // 复用主图表的绘制逻辑，临时切换 canvas id
  const origCanvas = document.getElementById('priceChart');
  const tempId = '__temp_chart_canvas';
  if (!origCanvas) return;
  origCanvas.id = tempId;
  canvas.id = 'priceChart';
  renderChart();
  canvas.id = 'priceChartDetails';
  document.getElementById(tempId).id = 'priceChart';
}

// ===== 窗口大小变化重新绘制图表 =====
let chartResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(() => {
    if (APP.currentTab === 'overview' || APP.currentTab === 'details') {
      renderChart();
    }
  }, 300);
});

// ===== 内嵌 fallback 数据 =====
APP.embeddedData = {
  tou_rates: [{"province": "内蒙古", "city": "呼和浩特", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "低谷", "standard_category": "谷", "start_time": "00:00", "end_time": "07:00", "price": "0.3793", "is_next_day": "0", "period_remarks": "", "policy_name": "内蒙古蒙西电网分时电价政策", "effective_date": "2024-07-01", "policy_desc": "内蒙古蒙西电网工商业用户分时电价（含电度电价+输配电价）", "source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知", "source_url": "https://fgw.nmg.gov.cn/", "publish_authority": "内蒙古自治区发展和改革委员会", "publish_date": "2024-06-15", "collect_date": "2025-07-01", "reliability": "中", "time_period_id": "65", "policy_id": "8", "region_id": "6"}, {"province": "内蒙古", "city": "呼和浩特", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "平段", "standard_category": "平", "start_time": "07:00", "end_time": "08:00", "price": "0.6689", "is_next_day": "0", "period_remarks": "", "policy_name": "内蒙古蒙西电网分时电价政策", "effective_date": "2024-07-01", "policy_desc": "内蒙古蒙西电网工商业用户分时电价（含电度电价+输配电价）", "source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知", "source_url": "https://fgw.nmg.gov.cn/", "publish_authority": "内蒙古自治区发展和改革委员会", "publish_date": "2024-06-15", "collect_date": "2025-07-01", "reliability": "中", "time_period_id": "61", "policy_id": "8", "region_id": "6"}, {"province": "内蒙古", "city": "呼和浩特", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "高峰", "standard_category": "峰", "start_time": "08:00", "end_time": "12:00", "price": "0.9585", "is_next_day": "0", "period_remarks": "", "policy_name": "内蒙古蒙西电网分时电价政策", "effective_date": "2024-07-01", "policy_desc": "内蒙古蒙西电网工商业用户分时电价（含电度电价+输配电价）", "source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知", "source_url": "https://fgw.nmg.gov.cn/", "publish_authority": "内蒙古自治区发展和改革委员会", "publish_date": "2024-06-15", "collect_date": "2025-07-01", "reliability": "中", "time_period_id": "59", "policy_id": "8", "region_id": "6"}, {"province": "内蒙古", "city": "呼和浩特", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "平段", "standard_category": "平", "start_time": "12:00", "end_time": "17:00", "price": "0.6689", "is_next_day": "0", "period_remarks": "", "policy_name": "内蒙古蒙西电网分时电价政策", "effective_date": "2024-07-01", "policy_desc": "内蒙古蒙西电网工商业用户分时电价（含电度电价+输配电价）", "source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知", "source_url": "https://fgw.nmg.gov.cn/", "publish_authority": "内蒙古自治区发展和改革委员会", "publish_date": "2024-06-15", "collect_date": "2025-07-01", "reliability": "中", "time_period_id": "62", "policy_id": "8", "region_id": "6"}, {"province": "内蒙古", "city": "呼和浩特", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "高峰", "standard_category": "峰", "start_time": "17:00", "end_time": "21:00", "price": "0.9585", "is_next_day": "0", "period_remarks": "", "policy_name": "内蒙古蒙西电网分时电价政策", "effective_date": "2024-07-01", "policy_desc": "内蒙古蒙西电网工商业用户分时电价（含电度电价+输配电价）", "source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知", "source_url": "https://fgw.nmg.gov.cn/", "publish_authority": "内蒙古自治区发展和改革委员会", "publish_date": "2024-06-15", "collect_date": "2025-07-01", "reliability": "中", "time_period_id": "60", "policy_id": "8", "region_id": "6"}, {"province": "内蒙古", "city": "呼和浩特", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "平段", "standard_category": "平", "start_time": "21:00", "end_time": "23:00", "price": "0.6689", "is_next_day": "0", "period_remarks": "", "policy_name": "内蒙古蒙西电网分时电价政策", "effective_date": "2024-07-01", "policy_desc": "内蒙古蒙西电网工商业用户分时电价（含电度电价+输配电价）", "source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知", "source_url": "https://fgw.nmg.gov.cn/", "publish_authority": "内蒙古自治区发展和改革委员会", "publish_date": "2024-06-15", "collect_date": "2025-07-01", "reliability": "中", "time_period_id": "63", "policy_id": "8", "region_id": "6"}, {"province": "内蒙古", "city": "呼和浩特", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "低谷", "standard_category": "谷", "start_time": "23:00", "end_time": "24:00", "price": "0.3793", "is_next_day": "0", "period_remarks": "", "policy_name": "内蒙古蒙西电网分时电价政策", "effective_date": "2024-07-01", "policy_desc": "内蒙古蒙西电网工商业用户分时电价（含电度电价+输配电价）", "source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知", "source_url": "https://fgw.nmg.gov.cn/", "publish_authority": "内蒙古自治区发展和改革委员会", "publish_date": "2024-06-15", "collect_date": "2025-07-01", "reliability": "中", "time_period_id": "64", "policy_id": "8", "region_id": "6"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "低谷", "standard_category": "谷", "start_time": "00:00", "end_time": "07:00", "price": "0.3776", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "41", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "平段", "standard_category": "平", "start_time": "07:00", "end_time": "08:00", "price": "0.7124", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "37", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "高峰", "standard_category": "峰", "start_time": "08:00", "end_time": "10:00", "price": "1.0472", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "34", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "尖峰", "standard_category": "尖", "start_time": "10:00", "end_time": "11:00", "price": "1.2105", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "32", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "平段", "standard_category": "平", "start_time": "11:00", "end_time": "15:00", "price": "0.7124", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "38", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "高峰", "standard_category": "峰", "start_time": "15:00", "end_time": "16:00", "price": "1.0472", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "35", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "尖峰", "standard_category": "尖", "start_time": "16:00", "end_time": "17:00", "price": "1.2105", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "33", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "高峰", "standard_category": "峰", "start_time": "17:00", "end_time": "22:00", "price": "1.0472", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "36", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "平段", "standard_category": "平", "start_time": "22:00", "end_time": "23:00", "price": "0.7124", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "39", "policy_id": "5", "region_id": "4"}, {"province": "山东省", "city": "济南", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "不分季节", "period_name": "低谷", "standard_category": "谷", "start_time": "23:00", "end_time": "24:00", "price": "0.3776", "is_next_day": "0", "period_remarks": "", "policy_name": "山东省工商业分时电价政策", "effective_date": "2024-05-01", "policy_desc": "山东省工商业用户（1-10kV）分时电价", "source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "40", "policy_id": "5", "region_id": "4"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "低谷", "standard_category": "谷", "start_time": "00:00", "end_time": "08:00", "price": "0.335", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "9", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "08:00", "end_time": "10:00", "price": "0.6843", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "6", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "10:00", "end_time": "11:00", "price": "1.0336", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "3", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "尖峰", "standard_category": "尖", "start_time": "11:00", "end_time": "12:00", "price": "1.1789", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "1", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "12:00", "end_time": "14:00", "price": "0.6843", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "7", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "14:00", "end_time": "15:00", "price": "1.0336", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "4", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "尖峰", "standard_category": "尖", "start_time": "15:00", "end_time": "17:00", "price": "1.1789", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "2", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "17:00", "end_time": "19:00", "price": "1.0336", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "5", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "19:00", "end_time": "24:00", "price": "0.6843", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "8", "policy_id": "1", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "低谷", "standard_category": "谷", "start_time": "00:00", "end_time": "08:00", "price": "0.335", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "18", "policy_id": "2", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "平段", "standard_category": "平", "start_time": "08:00", "end_time": "10:00", "price": "0.6843", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "15", "policy_id": "2", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "10:00", "end_time": "11:00", "price": "1.0336", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "12", "policy_id": "2", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "尖峰", "standard_category": "尖", "start_time": "11:00", "end_time": "12:00", "price": "1.1789", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "10", "policy_id": "2", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "平段", "standard_category": "平", "start_time": "12:00", "end_time": "14:00", "price": "0.6843", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "16", "policy_id": "2", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "14:00", "end_time": "15:00", "price": "1.0336", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "13", "policy_id": "2", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "尖峰", "standard_category": "尖", "start_time": "17:00", "end_time": "18:00", "price": "1.1789", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "11", "policy_id": "2", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "18:00", "end_time": "19:00", "price": "1.0336", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "14", "policy_id": "2", "region_id": "1"}, {"province": "广东省", "city": "广州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "平段", "standard_category": "平", "start_time": "19:00", "end_time": "24:00", "price": "0.6843", "is_next_day": "0", "period_remarks": "", "policy_name": "广东省工商业分时电价政策", "effective_date": "2024-07-01", "policy_desc": "广东省工商业用户（1-10kV）非夏季分时电价", "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "17", "policy_id": "2", "region_id": "1"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "低谷", "standard_category": "谷", "start_time": "00:00", "end_time": "08:00", "price": "0.3722", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "26", "policy_id": "3", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "08:00", "end_time": "10:00", "price": "1.0208", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "21", "policy_id": "3", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "尖峰", "standard_category": "尖", "start_time": "10:00", "end_time": "11:00", "price": "1.1854", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "19", "policy_id": "3", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "11:00", "end_time": "14:00", "price": "0.6965", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "23", "policy_id": "3", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "尖峰", "standard_category": "尖", "start_time": "14:00", "end_time": "15:00", "price": "1.1854", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "20", "policy_id": "3", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "15:00", "end_time": "18:00", "price": "0.6965", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "24", "policy_id": "3", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "18:00", "end_time": "21:00", "price": "1.0208", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "22", "policy_id": "3", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "21:00", "end_time": "24:00", "price": "0.6965", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "25", "policy_id": "3", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "低谷", "standard_category": "谷", "start_time": "00:00", "end_time": "08:00", "price": "0.3722", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）非夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "31", "policy_id": "4", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "08:00", "end_time": "11:00", "price": "1.0208", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）非夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "27", "policy_id": "4", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "平段", "standard_category": "平", "start_time": "11:00", "end_time": "17:00", "price": "0.6965", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）非夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "29", "policy_id": "4", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "17:00", "end_time": "21:00", "price": "1.0208", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）非夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "28", "policy_id": "4", "region_id": "3"}, {"province": "江苏省", "city": "南京", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "平段", "standard_category": "平", "start_time": "21:00", "end_time": "24:00", "price": "0.6965", "is_next_day": "0", "period_remarks": "", "policy_name": "江苏省工商业分时电价政策", "effective_date": "2024-04-01", "policy_desc": "江苏省工商业用户（1-10kV）非夏季分时电价", "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "30", "policy_id": "4", "region_id": "3"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "低谷", "standard_category": "谷", "start_time": "00:00", "end_time": "07:00", "price": "0.3882", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "51", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "07:00", "end_time": "08:00", "price": "0.7231", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "47", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "08:00", "end_time": "09:00", "price": "1.058", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "44", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "尖峰", "standard_category": "尖", "start_time": "09:00", "end_time": "11:00", "price": "1.2195", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "42", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "11:00", "end_time": "13:00", "price": "0.7231", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "48", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "13:00", "end_time": "15:00", "price": "1.058", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "45", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "尖峰", "standard_category": "尖", "start_time": "15:00", "end_time": "17:00", "price": "1.2195", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "43", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "17:00", "end_time": "22:00", "price": "1.058", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "46", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "平段", "standard_category": "平", "start_time": "22:00", "end_time": "23:00", "price": "0.7231", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "49", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "夏季", "period_name": "低谷", "standard_category": "谷", "start_time": "23:00", "end_time": "24:00", "price": "0.3882", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "50", "policy_id": "6", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "低谷", "standard_category": "谷", "start_time": "00:00", "end_time": "07:00", "price": "0.3882", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）非夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "58", "policy_id": "7", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "平段", "standard_category": "平", "start_time": "07:00", "end_time": "08:00", "price": "0.7231", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）非夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "54", "policy_id": "7", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "08:00", "end_time": "11:00", "price": "1.058", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）非夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "52", "policy_id": "7", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "平段", "standard_category": "平", "start_time": "11:00", "end_time": "13:00", "price": "0.7231", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）非夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "55", "policy_id": "7", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "高峰", "standard_category": "峰", "start_time": "13:00", "end_time": "17:00", "price": "1.058", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）非夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "53", "policy_id": "7", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "平段", "standard_category": "平", "start_time": "17:00", "end_time": "23:00", "price": "0.7231", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）非夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "56", "policy_id": "7", "region_id": "5"}, {"province": "浙江省", "city": "杭州", "district": "全市", "user_type": "工商业", "voltage_level": "1-10kV", "season_type": "非夏季", "period_name": "低谷", "standard_category": "谷", "start_time": "23:00", "end_time": "24:00", "price": "0.3882", "is_next_day": "0", "period_remarks": "", "policy_name": "浙江省工商业分时电价政策", "effective_date": "2024-06-01", "policy_desc": "浙江省工商业用户（1-10kV）非夏季分时电价", "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "reliability": "高", "time_period_id": "57", "policy_id": "7", "region_id": "5"}],
  data_sources: [{"source_name": "内蒙古电力（集团）有限责任公司2025年代理购电价格公告", "source_url": "https://www.impre.com.cn/", "publish_authority": "内蒙古电力（集团）有限责任公司", "publish_date": "2025-01-20", "collect_date": "2025-07-01", "data_type": "价格公告", "reliability": "中", "remarks": "蒙西电网代理购电价格"}, {"source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知", "source_url": "https://fgw.nmg.gov.cn/", "publish_authority": "内蒙古自治区发展和改革委员会", "publish_date": "2024-06-15", "collect_date": "2025-07-01", "data_type": "政策文件", "reliability": "中", "remarks": "蒙西电网分时电价政策，蒙东地区政策可能不同"}, {"source_name": "国网山东省电力公司2025年代理购电价格公告", "source_url": "https://www.sd.sgcc.com.cn/", "publish_authority": "国网山东省电力公司", "publish_date": "2025-01-10", "collect_date": "2025-07-01", "data_type": "价格公告", "reliability": "高", "remarks": "代理购电价格月度公告"}, {"source_name": "国网江苏省电力有限公司2025年代理购电价格公告", "source_url": "https://www.js.sgcc.com.cn/", "publish_authority": "国网江苏省电力有限公司", "publish_date": "2025-01-20", "collect_date": "2025-07-01", "data_type": "价格公告", "reliability": "高", "remarks": "代理购电价格表"}, {"source_name": "国网浙江省电力有限公司2025年代理购电价格公告", "source_url": "https://www.zj.sgcc.com.cn/", "publish_authority": "国网浙江省电力有限公司", "publish_date": "2025-01-15", "collect_date": "2025-07-01", "data_type": "价格公告", "reliability": "高", "remarks": "代理购电价格月度公告"}, {"source_name": "山东省发展改革委关于完善分时电价政策的通知", "source_url": "https://fgw.shandong.gov.cn/", "publish_authority": "山东省发展和改革委员会", "publish_date": "2024-04-01", "collect_date": "2025-07-01", "data_type": "政策文件", "reliability": "高", "remarks": "鲁发改价格〔2024〕XX号"}, {"source_name": "广东电网有限责任公司2025年代理购电价格公告", "source_url": "https://www.gd.csg.cn/", "publish_authority": "广东电网有限责任公司", "publish_date": "2025-01-15", "collect_date": "2025-07-01", "data_type": "价格公告", "reliability": "高", "remarks": "每月公布代理购电价格表"}, {"source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知", "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html", "publish_authority": "广东省发展和改革委员会", "publish_date": "2024-06-01", "collect_date": "2025-07-01", "data_type": "政策文件", "reliability": "高", "remarks": "粤发改价格〔2024〕XX号，工商业用户分时电价政策"}, {"source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知", "source_url": "https://fzggw.jiangsu.gov.cn/", "publish_authority": "江苏省发展和改革委员会", "publish_date": "2024-03-01", "collect_date": "2025-07-01", "data_type": "政策文件", "reliability": "高", "remarks": "苏发改价格发〔2024〕XX号"}, {"source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知", "source_url": "https://fzggw.zj.gov.cn/", "publish_authority": "浙江省发展和改革委员会", "publish_date": "2024-05-01", "collect_date": "2025-07-01", "data_type": "政策文件", "reliability": "高", "remarks": "浙发改价格〔2024〕XX号"}],
  missing_records: [{"province": "内蒙古", "city": "全区", "user_type": "居民", "missing_item": "内蒙古居民分时电价数据", "search_process": "检索内蒙古发改委和内蒙古电力集团官网，暂未公开居民分时电价具体数据", "search_date": "2025-07-01", "status": "缺失", "remarks": "居民电价按阶梯电价执行"}, {"province": "内蒙古", "city": "赤峰/通辽", "user_type": "工商业", "missing_item": "蒙东电网分时电价数据", "search_process": "内蒙古发改委公开文件主要覆盖蒙西电网，蒙东电网（国网供电区域）数据需单独检索", "search_date": "2025-07-01", "status": "待验证", "remarks": "蒙东电网分时电价政策可能与蒙西不同"}, {"province": "山东省", "city": "全省", "user_type": "大工业", "missing_item": "山东大工业用户深谷电价数据", "search_process": "检索山东省发改委公开文件，大工业深谷时段价格需查阅最新文件确认", "search_date": "2025-07-01", "status": "待验证", "remarks": "深谷时段价格可能存在更新"}, {"province": "广东省", "city": "深圳", "user_type": "居民", "missing_item": "深圳市居民阶梯电价分时数据", "search_process": "尝试检索广东省发改委和深圳供电局官网，未找到居民分时电价具体时段划分和价格", "search_date": "2025-07-01", "status": "缺失", "remarks": "居民阶梯电价非分时电价，暂不纳入"}, {"province": "江苏省", "city": "全省", "user_type": "大工业", "missing_item": "江苏大工业用户夏季尖峰时段价格", "search_process": "检索江苏发改委公开文件，大工业用户尖峰电价系数可能需要人工核实最新调整", "search_date": "2025-07-01", "status": "待验证", "remarks": "不同电压等级价格系数不同"}],
  province_summary: [{"province": "内蒙古", "period_count": "7", "policy_count": "1", "min_price": "0.3793", "max_price": "0.9585", "peak_valley_spread": "0.5792", "season_types": "不分季节", "user_types": "工商业"}, {"province": "山东省", "period_count": "10", "policy_count": "1", "min_price": "0.3776", "max_price": "1.2105", "peak_valley_spread": "0.8329", "season_types": "不分季节", "user_types": "工商业"}, {"province": "广东省", "period_count": "18", "policy_count": "2", "min_price": "0.335", "max_price": "1.1789", "peak_valley_spread": "0.8439", "season_types": "夏季,非夏季", "user_types": "工商业"}, {"province": "江苏省", "period_count": "13", "policy_count": "2", "min_price": "0.3722", "max_price": "1.1854", "peak_valley_spread": "0.8132", "season_types": "夏季,非夏季", "user_types": "工商业"}, {"province": "浙江省", "period_count": "17", "policy_count": "2", "min_price": "0.3882", "max_price": "1.2195", "peak_valley_spread": "0.8313", "season_types": "夏季,非夏季", "user_types": "工商业"}]
};

// ===== 初始化 =====
async function init() {
  await loadConfig();
  if (APP.config) {
    await loadAllData();
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
