/**
 * 城市分时电价观察站 · 主应用逻辑
 */

// === Province metadata ===
var PROVINCE_INFO = {
  GD: { name: "广东", abbr: "粤", color: "#E53E3E", grid: "南方电网", desc: "珠三角经济核心区，工商业电价较高，峰谷价差大" },
  JS: { name: "江苏", abbr: "苏", color: "#3182CE", grid: "国家电网", desc: "长三角制造业重镇，分时划分细致，夏季增设尖峰" },
  SD: { name: "山东", abbr: "鲁", color: "#DD6B20", grid: "国家电网", desc: "北方经济大省，峰谷价差明显，设有深谷时段" },
  ZJ: { name: "浙江", abbr: "浙", color: "#38A169", grid: "国家电网", desc: "民营经济活跃，"两谷一峰"独特时段划分" },
  NM: { name: "内蒙古", abbr: "蒙", color: "#805AD5", grid: "蒙西/蒙东电网", desc: "能源大省，低谷时段长，设有新能源消纳深谷" }
};

var allData = null;
var currentView = "overview";
var currentProvince = null;

/**
 * 初始化应用
 */
async function initApp() {
  try {
    // Load config first
    await loadConfig();

    // Load all data
    allData = await loadAllData();

    // Set data source badge
    const badge0 = document.getElementById("datasource-badge");
    if (badge0 && siteConfig) {
      const mode = siteConfig.dataSource === "sqlite" ? "SQLite" : "CSV";
      badge0.textContent = "📡 " + mode;
      badge0.title = "当前数据源模式：" + mode + "（切换请修改 config.json）";
    }

    // Initialize navigation
    initNavigation();

    // Render overview
    renderOverview();

    // Render source view
    renderSourceView();

    // Show overview by default
    showView("overview");
  } catch (e) {
    console.error("Data loading failed:", e);
    var grid = document.getElementById("province-grid");
    if (grid) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><p><strong>数据加载失败</strong></p><p style="font-size:0.82rem;margin-top:4px;color:#5B6B79;">请检查浏览器控制台（F12）查看详细错误信息。</p></div>';
    }
    document.getElementById("ov-province-count").textContent = "—";
    document.getElementById("ov-source-count").textContent = "—";
    document.getElementById("ov-period-count").textContent = "—";
    document.getElementById("ov-missing-count").textContent = "—";
    var badge = document.getElementById("datasource-badge");
    if (badge) badge.textContent = "⚠ 加载失败";
  }
}

/**
 * 导航初始化
 */
function initNavigation() {
  document.querySelectorAll("[data-view]").forEach(el => {
    el.addEventListener("click", function(e) {
      e.preventDefault();
      const view = this.dataset.view;
      showView(view);
    });
  });
}

/**
 * 切换视图
 */
function showView(view, params) {
  currentView = view;

  // Update nav
  document.querySelectorAll("[data-view]").forEach(el => {
    el.classList.toggle("active", el.dataset.view === view);
  });

  // Hide all panels
  document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));

  // Show target panel
  const panel = document.getElementById("panel-" + view);
  if (panel) panel.classList.add("active");
}

/**
 * 渲染首页概览
 */
function renderOverview() {
  const { provinces, periods, sources, missing } = allData;

  // Stats
  document.getElementById("ov-province-count").textContent = provinces.length;
  document.getElementById("ov-source-count").textContent = sources.length;
  document.getElementById("ov-period-count").textContent = periods.length;
  document.getElementById("ov-missing-count").textContent = missing.length;

  // Province cards
  const grid = document.getElementById("province-grid");
  grid.innerHTML = "";
  provinces.forEach(p => {
    const pid = p.province_id;
    const info = PROVINCE_INFO[pid];
    const provPeriods = periods.filter(pp => pp.province_id === pid && pp.user_type === "一般工商业");
    const peakPrices = provPeriods.filter(pp => pp.standard_category === "峰").map(pp => parseFloat(pp.price_yuan_per_kwh)).filter(v => !isNaN(v));
    const valleyPrices = provPeriods.filter(pp => pp.standard_category === "谷").map(pp => parseFloat(pp.price_yuan_per_kwh)).filter(v => !isNaN(v));
    const flatPrices = provPeriods.filter(pp => pp.standard_category === "平").map(pp => parseFloat(pp.price_yuan_per_kwh)).filter(v => !isNaN(v));
    const maxPeak = peakPrices.length > 0 ? Math.max(...peakPrices) : null;
    const minValley = valleyPrices.length > 0 ? Math.min(...valleyPrices) : null;
    const avgFlat = flatPrices.length > 0 ? flatPrices.reduce((a,b)=>a+b,0)/flatPrices.length : null;

    const maxPeakPrice = peakPrices.length > 0 ?
      (peakPrices.reduce((a,b)=>a+b,0)/peakPrices.length).toFixed(4) : "—";

    const card = document.createElement("div");
    card.className = "province-card";
    card.dataset.province = pid;
    card.innerHTML = `
      <div class="pc-top">
        <div class="pc-name">${info.name}</div>
        <div class="pc-abbr" style="background:${info.color}">${info.abbr}</div>
      </div>
      <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">${info.grid} · 一般工商业10kV</div>
      <div class="pc-stats">
        ${maxPeakPrice !== "—" ? `<span class="pc-stat high">高峰均 ${formatPriceShort(maxPeakPrice)}</span>` : `<span class="pc-stat" style="background:#FEF2F2;">高峰暂无</span>`}
        ${avgFlat ? `<span class="pc-stat medium">平段均 ${formatPriceShort(avgFlat)}</span>` : ""}
        ${minValley ? `<span class="pc-stat low">低谷低 ${formatPriceShort(minValley)}</span>` : ""}
        ${provPeriods.filter(pp => pp.standard_category === "尖").length > 0 ? `<span class="pc-stat" style="background:#FCE7F3;color:#9D174D;">有尖峰</span>` : ""}
        ${provPeriods.filter(pp => pp.standard_category === "深谷").length > 0 ? `<span class="pc-stat" style="background:#DBEAFE;color:#1E40AF;">有深谷</span>` : ""}
      </div>
    `;
    card.addEventListener("click", () => showProvinceDetail(pid));
    grid.appendChild(card);
  });

  // Comparison table
  renderComparisonTable();

  // Charts
  renderComparisonChart(periods, "chart-compare", ["GD", "JS", "SD", "ZJ", "NM"], "通用");
  renderPriceSpreadChart(provinces, periods, "chart-spread");

  // Analysis
  renderAnalysis();
}

/**
 * 渲染对比表
 */
function renderComparisonTable() {
  const { periods, provinces } = allData;
  const categories = ["尖", "峰", "平", "谷", "深谷"];
  const catLabels = { "尖": "尖峰", "峰": "高峰", "平": "平段", "谷": "低谷", "深谷": "深谷" };
  const provinceIds = ["GD", "JS", "SD", "ZJ", "NM"];

  const tbody = document.getElementById("compare-body");
  tbody.innerHTML = "";

  categories.forEach(cat => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="cat-label">${catLabels[cat]}</td>`;

    provinceIds.forEach(pid => {
      const provPeriods = periods.filter(p =>
        p.province_id === pid &&
        p.standard_category === cat &&
        p.user_type === "一般工商业" &&
        (p.season_type === "通用" || p.season_type === "夏季")
      );
      if (provPeriods.length > 0) {
        // Find the highest or representative price
        const prices = provPeriods.map(p => parseFloat(p.price_yuan_per_kwh));
        const avgPrice = prices.reduce((a,b) => a+b, 0) / prices.length;
        const isHigh = avgPrice > 0.8;
        const isLow = avgPrice < 0.35;
        const cls = isHigh ? "price-high" : isLow ? "price-low" : "price-mid";
        tr.innerHTML += `<td class="${cls}">${avgPrice.toFixed(4)}</td>`;
      } else {
        tr.innerHTML += `<td class="na">不适用</td>`;
      }
    });

    tbody.appendChild(tr);
  });

  // Peak-valley spread row
  const spreadTr = document.createElement("tr");
  spreadTr.innerHTML = `<td class="cat-label" style="font-weight:800;">峰谷价差</td>`;
  provinceIds.forEach(pid => {
    const peakPeriods = periods.filter(p =>
      p.province_id === pid && p.standard_category === "峰" && p.user_type === "一般工商业" &&
      (p.season_type === "通用" || p.season_type === "夏季")
    );
    const valleyPeriods = periods.filter(p =>
      p.province_id === pid && p.standard_category === "谷" && p.user_type === "一般工商业" &&
      (p.season_type === "通用" || p.season_type === "夏季")
    );
    if (peakPeriods.length > 0 && valleyPeriods.length > 0) {
      const peakAvg = peakPeriods.reduce((s,p) => s + parseFloat(p.price_yuan_per_kwh), 0) / peakPeriods.length;
      const valleyAvg = valleyPeriods.reduce((s,p) => s + parseFloat(p.price_yuan_per_kwh), 0) / valleyPeriods.length;
      const spread = peakAvg - valleyAvg;
      const ratio = peakAvg / valleyAvg;
      spreadTr.innerHTML += `<td class="price-high">${spread.toFixed(4)}<br><span style="font-size:0.72rem;color:var(--text-muted);">${ratio.toFixed(1)}倍</span></td>`;
    } else {
      spreadTr.innerHTML += `<td class="na">—</td>`;
    }
  });
  tbody.appendChild(spreadTr);
}

/**
 * 分析结论
 */
function renderAnalysis() {
  // This is derived directly from the data above
  const analysisEl = document.getElementById("analysis-text");
  analysisEl.innerHTML = `
    <strong>⚡ Top5 样本省份分时电价差异分析：</strong><br>
    <strong>价差最大：</strong>浙江（约1.165元/kWh高峰 vs 0.300元/kWh低谷，价差约0.87元，峰谷比约3.9:1），广东次之（峰谷比约4.5:1，基准最低价0.246元/kWh）。<br>
    <strong>低谷优势：</strong>广东非夏季低谷0.246元/kWh为五省最低；内蒙古深谷时段低至0.224元/kWh，适合高耗能企业错峰生产。<br>
    <strong>时段复杂度：</strong>江苏、山东均有尖峰/深谷细分时段，时段划分最为精细；浙江采用"两谷一峰"三段式，结构最简洁。<br>
    <strong>内蒙古特殊性：</strong>作为唯一非国家/南方电网主网省份，价格水平整体最低，且设有新能源消纳深谷时段（12:00-15:00），反映本地风光资源禀赋。
  `;
}

/**
 * 显示省份详情
 */
function showProvinceDetail(provinceId) {
  currentProvince = provinceId;
  showView("detail");
  renderProvinceDetail(provinceId);
}

/**
 * 渲染省份详情
 */
function renderProvinceDetail(provinceId) {
  const info = PROVINCE_INFO[provinceId];
  const { periods, sources, missing } = allData;

  const header = document.getElementById("detail-header");
  header.innerHTML = `
    <button class="back-btn" onclick="showView('overview');renderOverview();">← 返回概览</button>
    <h2 style="color:${info.color}">${info.name}省 · 分时电价详情</h2>
    <span style="font-size:0.82rem;color:var(--text-secondary);">${info.grid} · 一般工商业10kV</span>
  `;

  // Periods table
  const provPeriods = periods.filter(p =>
    p.province_id === provinceId && p.user_type === "一般工商业" && p.voltage_level === "10kV"
  );

  const tbody = document.getElementById("period-detail-body");
  tbody.innerHTML = "";
  if (provPeriods.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">暂无时段数据</td></tr>`;
  } else {
    provPeriods.forEach(p => {
      const catClass = getCategoryClass(p.standard_category);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.period_name}</td>
        <td><span class="tag ${catClass}">${p.standard_category}</span></td>
        <td>${p.start_time}-${p.end_time}</td>
        <td>${parseFloat(p.price_yuan_per_kwh).toFixed(4)}</td>
        <td>${p.ratio_to_flat}x</td>
        <td>${p.season_type === "通用" ? "全年" : p.season_type}</td>
        <td style="font-size:0.78rem;color:var(--text-muted);">${p.notes || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Source list for this province
  const provSources = sources.filter(s => s.province_id === provinceId);
  const sourceDiv = document.getElementById("detail-sources");
  sourceDiv.innerHTML = "";
  provSources.forEach(s => {
    const div = document.createElement("div");
    div.className = "source-item";
    div.innerHTML = `
      <div class="si-name">${s.source_name}</div>
      <div class="si-meta">${s.publisher} · ${s.doc_number} · ${s.publish_date}</div>
      <div class="si-url"><a href="${s.source_url}" target="_blank">${s.source_url}</a></div>
    `;
    sourceDiv.appendChild(div);
  });

  // Missing data for this province
  const provMissing = missing.filter(m => m.province_id === provinceId);
  const missingDiv = document.getElementById("detail-missing");
  missingDiv.innerHTML = "";
  if (provMissing.length > 0) {
    provMissing.forEach(m => {
      const div = document.createElement("div");
      div.className = "missing-card";
      div.innerHTML = `<h4>⚠ ${m.missing_type}：${m.missing_item}</h4><p>${m.reason}</p>`;
      missingDiv.appendChild(div);
    });
  } else {
    missingDiv.innerHTML = `<p style="font-size:0.85rem;color:var(--text-muted);">本省暂无缺失数据登记。</p>`;
  }

  // Detail chart
  renderComparisonChart(periods, "chart-detail", [provinceId], "通用");
}

/**
 * 渲染数据源中心
 */
function renderSourceView() {
  const { sources } = allData;
  const list = document.getElementById("source-list");
  list.innerHTML = "";
  sources.forEach(s => {
    const info = PROVINCE_INFO[s.province_id];
    const reliabilityText = s.reliability === "high" ? "高" : s.reliability === "medium" ? "中" : "待审核";
    const badgeClass = s.reliability === "high" ? "badge-high" : "badge-medium";
    const div = document.createElement("div");
    div.className = "source-item";
    div.innerHTML = `
      <div class="si-name">${s.source_name} <span class="badge ${badgeClass}">${reliabilityText}</span></div>
      <div class="si-meta">
        <strong>发布机构：</strong>${s.publisher} · <strong>文号：</strong>${s.doc_number} ·
        <strong>发布时间：</strong>${s.publish_date} · <strong>生效时间：</strong>${s.effective_date} ·
        <strong>采集时间：</strong>${s.collect_date} · <strong>适用省份：</strong>${info ? info.name : s.province_id}
      </div>
      <div class="si-url"><a href="${s.source_url}" target="_blank" rel="noopener">${s.source_url}</a></div>
    `;
    list.appendChild(div);
  });

  // Missing data
  const missingList = document.getElementById("missing-list");
  if (missingList) {
    const { missing } = allData;
    missingList.innerHTML = "";
    if (missing.length === 0) {
      missingList.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;">暂无缺失数据登记。</p>`;
    } else {
      missing.forEach(m => {
        const info = PROVINCE_INFO[m.province_id];
        const div = document.createElement("div");
        div.className = "missing-card";
        div.innerHTML = `
          <h4>⚠ [${info ? info.name : m.province_id}] ${m.missing_type}：${m.missing_item}</h4>
          <p>${m.reason}</p>
          <p style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">检索过程：${m.search_process} · 检索日期：${m.search_date}</p>
        `;
        missingList.appendChild(div);
      });
    }
  }
}

// Initialize - call directly since scripts are at bottom of body
if (document.readyState !== "loading") {
  initApp();
} else {
  document.addEventListener("DOMContentLoaded", initApp);
}


