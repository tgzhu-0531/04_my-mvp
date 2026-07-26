/**
 * 城市分时电价观察站 · 配置加载器
 * 读取 config.json 并切换数据源
 */
var siteConfig = null;
var dataCache = {};

async function loadConfig() {
  try {
    const resp = await fetch("./config.json");
    siteConfig = await resp.json();
    console.log("Config loaded:", siteConfig.dataSource);
    return siteConfig;
  } catch (e) {
    console.error("Failed to load config.json:", e);
    return null;
  }
}

/**
 * 简易 CSV 解析器
 */
function parseCSV(text) {
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += line[i];
      }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

/**
 * 加载 CSV 数据
 */
async function loadCSV(filename) {
  if (dataCache[filename]) return dataCache[filename];
  const resp = await fetch("./data/" + filename);
  let text = await resp.text();
  // Remove BOM if still present at byte level
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const data = parseCSV(text);
  dataCache[filename] = data;
  return data;
}

/**
 * 数据加载器主函数
 * 根据 config.json 的 dataSource 选用 CSV 或 SQLite 模式
 */
async function loadAllData() {
  if (!siteConfig) await loadConfig();

  if (siteConfig.dataSource === "csv") {
    const [provinces, periods, sources, missing] = await Promise.all([
      loadCSV("provinces.csv"),
      loadCSV("time_periods.csv"),
      loadCSV("sources.csv"),
      loadCSV("missing_data.csv")
    ]);
    return { provinces, periods, sources, missing };
  } else if (siteConfig.dataSource === "sqlite") {
    // SQLite mode - fetch from local API
    const baseUrl = siteConfig.sqliteConfig.apiEndpoint;
    try {
      const [provinces, periods, sources, missing] = await Promise.all([
        fetch(baseUrl + "/provinces").then(r => r.json()),
        fetch(baseUrl + "/time_periods").then(r => r.json()),
        fetch(baseUrl + "/sources").then(r => r.json()),
        fetch(baseUrl + "/missing_data").then(r => r.json())
      ]);
      return { provinces, periods, sources, missing };
    } catch (e) {
      console.error("SQLite API unavailable, falling back to CSV", e);
      return await loadAllDataFallback();
    }
  }
}

async function loadAllDataFallback() {
  const [provinces, periods, sources, missing] = await Promise.all([
    loadCSV("provinces.csv"),
    loadCSV("time_periods.csv"),
    loadCSV("sources.csv"),
    loadCSV("missing_data.csv")
  ]);
  return { provinces, periods, sources, missing };
}

/**
 * 工具函数：获取省份颜色
 */
function getProvinceColor(provinceId) {
  const colors = { GD: "#E53E3E", JS: "#3182CE", SD: "#DD6B20", ZJ: "#38A169", NM: "#805AD5" };
  return colors[provinceId] || "#666";
}

/**
 * 工具函数：标准分类标签CSS类
 */
function getCategoryClass(cat) {
  const map = { "尖": "tag-sharp", "峰": "tag-peak", "平": "tag-flat", "谷": "tag-valley", "深谷": "tag-deep" };
  return map[cat] || "";
}

/**
 * 工具函数：价格显示
 */
function formatPrice(price) {
  if (!price || price === "" || isNaN(parseFloat(price))) return "—";
  return parseFloat(price).toFixed(4) + " 元/kWh";
}

function formatPriceShort(price) {
  if (!price || price === "" || isNaN(parseFloat(price))) return "—";
  return parseFloat(price).toFixed(3);
}

