/**
 * 城市分时电价观察站 · 图表绘制模块
 * 依赖 Chart.js (通过 CDN 加载)
 */

var chartInstances = {};

/**
 * 将时段数据转换为 24h 价格曲线（以半小时为粒度）
 */
function buildPriceCurve(periods, provinceId, seasonType) {
  const curve = {};
  // 初始化 00:00-24:00 每半小时
  for (let h = 0; h < 48; h++) {
    const hour = Math.floor(h / 2);
    const min = (h % 2) * 30;
    const key = String(hour).padStart(2, "0") + ":" + String(min).padStart(2, "0");
    curve[key] = null;
  }

  const provPeriods = periods.filter(p => {
    if (p.province_id !== provinceId) return false;
    if (seasonType && p.season_type !== seasonType && p.season_type !== "通用") return false;
    if (!seasonType && p.season_type !== "通用") return false;
    return true;
  });

  provPeriods.forEach(p => {
    const start = p.start_time;
    const end = p.end_time;
    const price = parseFloat(p.price_yuan_per_kwh) || 0;

    // Parse times
    const startParts = start.split(":").map(Number);
    const endParts = end.split(":").map(Number);
    let startMin = startParts[0] * 60 + startParts[1];
    let endMin = endParts[0] * 60 + endParts[1];

    // Handle overnight periods (e.g., 22:00-08:00)
    if (endMin <= startMin) endMin += 1440;

    for (let m = startMin; m < endMin; m += 30) {
      const adjustedM = m % 1440;
      const hour = Math.floor(adjustedM / 60);
      const min = adjustedM % 60;
      const key = String(hour).padStart(2, "0") + ":" + String(min).padStart(2, "0");
      curve[key] = price;
    }
  });

  return curve;
}

/**
 * 渲染多省份对比曲线图
 */
function renderComparisonChart(periods, containerId, provinceIds, seasonType) {
  if (typeof Chart === 'undefined') { var el = document.getElementById(containerId); if (el) { el.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:#9099A6;font-size:0.85rem;">📊 Chart.js 未加载，请检查网络连接</div>'; } return; }
  const ctx = document.getElementById(containerId);
  if (!ctx) return;

  if (chartInstances[containerId]) {
    chartInstances[containerId].destroy();
  }

  const labels = [];
  for (let h = 0; h < 48; h++) {
    const hour = Math.floor(h / 2);
    const min = (h % 2) * 30;
    labels.push(String(hour).padStart(2, "0") + ":" + String(min).padStart(2, "0"));
  }

  const datasets = [];
  const provinceNameMap = { GD: "广东", JS: "江苏", SD: "山东", ZJ: "浙江", NM: "内蒙古" };
  const colorMap = { GD: "#E53E3E", JS: "#3182CE", SD: "#DD6B20", ZJ: "#38A169", NM: "#805AD5" };

  provinceIds.forEach(pid => {
    const curve = buildPriceCurve(periods, pid, seasonType);
    const data = labels.map(l => curve[l]);
    datasets.push({
      label: provinceNameMap[pid] || pid,
      data: data,
      borderColor: colorMap[pid] || "#666",
      backgroundColor: colorMap[pid] + "20",
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false
    });
  });

  chartInstances[containerId] = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } },
        tooltip: {
          callbacks: {
            title: function(items) { return "时间: " + items[0].label; },
            label: function(item) {
              const val = item.raw;
              if (val === null) return item.dataset.label + ": 无数据";
              return item.dataset.label + ": " + val.toFixed(4) + " 元/kWh";
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "时段", color: "#5B6B79" },
          ticks: {
            maxTicksLimit: 12,
            callback: function(val) { return labels[val]; }
          },
          grid: { display: false }
        },
        y: {
          title: { display: true, text: "电价 (元/kWh)", color: "#5B6B79" },
          beginAtZero: false,
          grid: { color: "#F0F2F5" }
        }
      }
    }
  });
}

/**
 * 渲染峰谷价差柱状图
 */
function renderPriceSpreadChart(provinces, periods, containerId) {
  if (typeof Chart === 'undefined') { var el = document.getElementById(containerId); if (el) { el.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:#9099A6;font-size:0.85rem;">📊 Chart.js 未加载</div>'; } return; }
  const ctx = document.getElementById(containerId);
  if (!ctx) return;

  if (chartInstances[containerId]) chartInstances[containerId].destroy();

  const provinceNameMap = { GD: "广东", JS: "江苏", SD: "山东", ZJ: "浙江", NM: "内蒙古" };
  const colorMap = { GD: "#E53E3E", JS: "#3182CE", SD: "#DD6B20", ZJ: "#38A169", NM: "#805AD5" };

  const labels = [];
  const peakData = [];
  const flatData = [];
  const valleyData = [];
  const spreadData = [];

  provinces.forEach(p => {
    const pid = p.province_id;
    const provPeriods = periods.filter(pp => pp.province_id === pid && pp.user_type === "一般工商业");

    const peak = provPeriods.find(pp => pp.standard_category === "峰");
    const flat = provPeriods.find(pp => pp.standard_category === "平");
    const valley = provPeriods.find(pp => pp.standard_category === "谷");

    labels.push(provinceNameMap[pid] || pid);
    peakData.push(peak ? parseFloat(peak.price_yuan_per_kwh) : 0);
    flatData.push(flat ? parseFloat(flat.price_yuan_per_kwh) : 0);
    valleyData.push(valley ? parseFloat(valley.price_yuan_per_kwh) : 0);
    if (peak && valley) {
      spreadData.push(parseFloat(peak.price_yuan_per_kwh) - parseFloat(valley.price_yuan_per_kwh));
    } else {
      spreadData.push(0);
    }
  });

  chartInstances[containerId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "高峰电价", data: peakData, backgroundColor: "#EF4444", borderRadius: 4 },
        { label: "平段电价", data: flatData, backgroundColor: "#F59E0B", borderRadius: 4 },
        { label: "低谷电价", data: valleyData, backgroundColor: "#10B981", borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: function(item) { return item.dataset.label + ": " + item.raw.toFixed(4) + " 元/kWh"; }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          title: { display: true, text: "电价 (元/kWh)", color: "#5B6B79" },
          grid: { color: "#F0F2F5" }
        }
      }
    }
  });
}