# 城市分时电价观察站 MVP

> 基于同一份 PRD 需求文档搭建的"城市分时电价观察站"MVP，覆盖广东、江苏、山东、浙江、内蒙古 5 个重点省份的分时电价数据展示与对比分析。

---

## 项目结构

```
11_Claude/
├── index.html              # 网站首页（入口）
├── config.json              # 数据源配置文件
├── init_db.py               # SQLite 数据库初始化脚本
├── README.md                # 本文档
├── DATA_DICTIONARY.md       # 数据字典
├── DATA_SOURCES.md          # 数据源清单
├── KNOWN_LIMITATIONS.md     # 已知限制说明
├── data/
│   ├── csv/                 # CSV 数据文件（静态场景）
│   │   ├── regions.csv
│   │   ├── policies.csv
│   │   ├── time_periods.csv
│   │   ├── price_points.csv
│   │   └── sources.csv
│   └── sqlite/              # SQLite 数据库目录（运行 init_db.py 后生成）
│       └── electricity_pricing.db
└── server/
    └── app.py               # SQLite 数据接口服务（Python）
```

---

## 启动方式

### 方式一：CSV 静态模式（GitHub Pages / IIS）

1. 确认 `config.json` 中 `dataSource` 为 `"csv"`
2. 用浏览器直接打开 `11_Claude/index.html`
3. 前端自动读取 `data/csv/` 目录下的 CSV 文件

**适用场景**：Windows IIS 静态站点、GitHub Pages 托管

### 方式二：SQLite 后端模式（本地完整验证）

1. 初始化数据库：
   ```bash
   cd 11_Claude
   pip3 install --break-system-packages -r /dev/null  # 无额外依赖（仅用 Python 标准库）
   python3 init_db.py
   ```
2. 启动数据接口服务：
   ```bash
   python3 server/app.py
   ```
3. 修改 `config.json` 中 `dataSource` 为 `"sqlite"`
4. 用浏览器打开 `11_Claude/index.html`

**适用场景**：Windows 本地完整验证

---

## 数据源切换方式

通过修改 `config.json` 中的 `dataSource` 字段切换：

```json
{
  "dataSource": "csv",       // CSV 模式：前端直接读取 CSV 文件
  // 或
  "dataSource": "sqlite"    // SQLite 模式：前端通过 API 访问 SQLite 数据库
}
```

- **CSV 模式**：纯前端运行，无需后端服务
- **SQLite 模式**：需要先运行 `init_db.py` 初始化数据库，再运行 `server/app.py` 启动 API 服务

切换完成后**刷新页面**即可生效。

---

## 数据库初始化

```bash
# 1. 确保在 11_Claude 目录下
cd 11_Claude

# 2. 运行初始化脚本（会创建 data/sqlite/electricity_pricing.db）
python3 init_db.py

# 3. 启动 API 服务
python3 server/app.py
# 服务运行在 http://localhost:3456
```

---

## 覆盖省份与来源

| 省份 | 数据状态 | 主要来源 |
|------|---------|---------|
| 广东省 | ✅ 已确认（夏季/春秋季/冬季） | 广东省能源局 2024 通知 |
| 江苏省 | ✅ 已确认（夏季尖峰+冬季尖峰） | 苏发改价格发〔2024〕574 号 |
| 山东省 | ✅ 已确认（五段式结构+深谷） | 国网山东电力公告、山东省发改委 |
| 浙江省 | ✅ 已确认（大工业+一般工商业） | 浙发改价格〔2024〕21 号 |
| 内蒙古 | ✅ 已确认（蒙西+蒙东电网） | 内发改价费〔2024〕号 |

---

## 网站功能

- **概览页**：覆盖省份数、数据源数、政策数、时段记录数
- **省份卡片**：5 省数据状态概览、价格范围
- **价格对比表**：尖/峰/平/谷/深谷 5 段价格、峰谷价差
- **一句话分析**：基于展示数据的差异分析结论
- **24h 电价曲线**：Chart.js 折线图，5 省叠加对比，图例可切换
- **数据源中心**：来源 URL、发布机构、发布时间、可靠性说明
- **缺失数据说明**：已检索但未找到的数据项

---

## 关于数据状态标签

| 标签 | 含义 |
|------|------|
| `confirmed` | 数据来自官方政策文件，可直接对应到来源 |
| `modeled` | 基于官方浮动比例和参考平段价格推算 |
| `estimated` | 估算值（基于行业平均水平或相邻地区类比） |
| `missing` | 经检索未找到稳定公开来源 |

价格数据和时段结构均基于公开政策文件整理。部分具体价格值（如平段基准价）为参考估算值，已在数据状态标签中明确标注。
