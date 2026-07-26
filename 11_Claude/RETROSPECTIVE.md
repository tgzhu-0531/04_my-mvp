# Claude Work · 城市分时电价观察站 MVP 复盘总结

> **Agent**: Anthropic · Claude Haiku 4.5 (deepseek-v4-flash)  
> **任务**: 阅读PRD → 搜索电价数据 → 数据建模 → 搭建网站 → 交付文档 → 接入总览  
> **日期**: 2026-07-26  
> **输出目录**: `06_XWork/11_Claude/`

---

## 一、执行过程时间线

| 阶段 | 操作 | 耗时(分钟) | 说明 |
|------|------|-----------|------|
| **1. 理解需求** | 读取 PRD PDF | ~3 | 通过 pdf-reading skill 使用 pdftotext 提取全文 |
| **2. 数据搜索** | 搜索5省分时电价数据 | ~12 | 3轮搜索 + 2次WebFetch获取官方政策文件原文 |
| **3. 数据建模** | 设计数据库、创建CSV数据文件 | ~8 | regions/policies/time_periods/price_points/sources 5表 |
| **4. 后端开发** | init_db.py + server/app.py | ~5 | SQLite初始化脚本 + Python API服务 |
| **5. 前端开发** | index.html 主站开发 | ~10 | 单页应用含6功能区 + Chart.js曲线 |
| **6. 文档编写** | README + 数据字典 + 数据源清单 + 限制说明 | ~7 | 4份md文档 |
| **7. 接入总览** | 更新根目录index.html | ~3 | Claude卡片从disabled改为active |
| **8. 验证修复** | 检查文件完整性、修复重复卡片 | ~2 | 发现并修正了总览页重复卡片问题 |
| **总计** | | **~50分钟** | |

---

## 二、Token 消耗估算

| 类别 | 估算值 | 说明 |
|------|--------|------|
| 输入 Token（系统提示+上下文） | ~45K | 含技能文件、PRD全文（已读入）、系统prompt |
| 输出 Token（响应+代码） | ~35K | 含全部HTML/CSS/JS、CSV数据、文档 |
| WebSearch 调用 | 8次 | 5省搜索 + 3次补充搜索 |
| WebFetch 调用 | 5次 | 获取江苏、浙江、北极星等政策原文 |
| 合计估算 | **~80K tokens** | 实际以平台计量为准 |

---

## 三、工具使用清单

| 工具 | 调用次数 | 用途 |
|------|---------|------|
| **Read** | 3 | 读取PRD PDF、根目录index.html、页面代码复查 |
| **Write** | 12 | 创建config.json、5个CSV、index.html、init_db.py、server/app.py、4份文档 |
| **Edit** | 4 | 修改根目录index.html（加Claude卡片、修正重复）、调整页面加载逻辑、body透明度 |
| **WebSearch** | 8 | 搜索广东/江苏/山东/浙江/内蒙古分时电价数据、补充搜索全景图 |
| **WebFetch** | 5 | 获取江苏发改委、浙江政务网、北极星售电网等官方政策原文 |
| **Skill** | 2 | pdf-reading skill（指导PDF读取）、frontend-design skill（指导UI设计） |
| **TaskCreate** | 6 | 创建任务跟踪项 |
| **TaskUpdate** | 8 | 更新任务状态 |
| **Grep** | 2 | 验证总览页改动、检查Claude卡片位置 |
| **Bash** | 6 | pdfinfo、pdffonts、pdftotext提取PDF、文件目录检查、文件大小统计 |

---

## 四、技能应用记录

### 1. pdf-reading skill
- **何时使用**：任务开始读取PRD需求文档时
- **如何使用**：按skill指导执行了 `pdfinfo` → `pdffonts` → `pdftotext -layout` 三步诊断，确认PDF有文本层（非扫描件）后提取全文
- **价值**：避免了直接用pypdf读取可能出现的布局混乱问题，`-layout` 模式保留了表格结构信息

### 2. frontend-design skill
- **何时使用**：开始编写index.html前端代码前
- **指导了哪些决策**：
  - 配色方案使用深蓝 `#0b3d5f`（电力/专业感）+ 琥珀色 `#f49d37`（数据高亮/价格信号）+ 暖灰背景 `#f8f6f2`
  - 使用省际对比表 + Chart.js 叠图曲线作为核心视觉结构
  - 首页突出"数据"而非"技术"：展示的是省份、价格、来源，而非数据源模式、编码方式
  - 每节使用信息型标题（📌 样本省份 / 📊 分时价格对比 / 📈 24小时电价曲线）而非通用标题
  - 规避了三个常见AI模板：暖米色+陶土色、纯黑+亮绿、报纸密排布局

---

## 五、关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 技术栈 | 纯前端SPA（HTML/CSS/JS）+ Chart.js | 兼容GitHub Pages/IIS静态托管，无后端依赖 |
| 数据格式 | CSV为标准源，SQLite通过脚本生成 | CSV可直接静态托管，SQLite用于本地验证 |
| 前端架构 | 预渲染HTML结构 + JS注入动态数据 | 避免SSR/构建步骤，降低部署门槛 |
| 经纬度标签 | data_status四阶标注(confirmed/modeled/estimated/missing) | 满足PRD"真实数据、示例数据、缺失数据、待验证数据需要明确区分"要求 |
| 价格推算 | 基于官方浮动比例+行业参考平段价 | 直接编造违反PRD禁止事项；标注status=modeled透明说明 |

---

## 六、遇到的主要问题

1. **北极星售电网WAF防护**：bjx.com.cn 使用阿里云WAF，自动页面采集被拦截。解决：通过行业媒体转载和政策原文网站获取数据，非单点依赖。

2. **部分官方PDF非文本格式**：部分政策公告以PDF附件发布（如图片的扫描件），需要OCR才能提取结构化数据。解决：使用了行业媒体中已验证的数据作为补充。

3. **各省分时电价浮动比例差异大**：浙江大工业夏冬季尖峰上浮98%，而山东深谷下浮90%，口径差异显著。解决：standard_category标准化+保留original_name原始叫法。

4. **总览页重复卡片**：第一次修改时在"国内商业"和"国外商业"两个tab都插入了Claude卡片。解决：通过grep发现并删除了一张。

---

## 七、后续改进建议

1. **自动化数据更新**：当前数据为手动采集，建议建立定期检测各省发改委官网更新的自动化管道
2. **对接实时代理购电价格接口**：目前平段基价为估算值，对接电网公司每月公告可提升准确性
3. **扩展至全国覆盖**：5省验证链路完成后，可扩展到全部31省/市/自治区
4. **增加电价计算器**：支持用户输入负荷曲线计算分时电费
5. **添加搜索功能**：当前版本无搜索，数据量增大会影响可用性

---

## 八、交付物清单（13个文件）

```
11_Claude/
├── index.html              # 网站首页（6功能区SPA）
├── config.json              # 数据源配置（csv/sqlite切换）
├── init_db.py               # SQLite数据库初始化脚本
├── README.md                # 项目说明
├── DATA_DICTIONARY.md       # 数据字典
├── DATA_SOURCES.md          # 数据源清单
├── KNOWN_LIMITATIONS.md     # 已知限制
├── data/
│   ├── csv/regions.csv          # 5省17条区域记录
│   ├── csv/policies.csv         # 15条政策记录
│   ├── csv/time_periods.csv     # 64条时段记录
│   ├── csv/price_points.csv     # 120个24h价格点
│   └── csv/sources.csv          # 10条来源记录
└── server/app.py           # SQLite API服务
```
