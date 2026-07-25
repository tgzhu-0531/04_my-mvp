# 城市分时电价观察站 MVP

> 基于政府公开政策文件的中国重点省份分时电价数据查询平台  
> 版本: 1.0.0 | 建议模型: Deepseek-v4-flash

## 项目结构

```
01_workbuddy/
├── index.html                 # 默认首页（SPA 入口，兼容 IIS 静态站点）
├── config.json                # JSON 配置文件（切换 sqlite / csv 数据源）
├── css/style.css              # 主样式表
├── js/
│   ├── data-loader.js         # 数据访问层（csv / api 双模式）
│   ├── charts.js              # Chart.js 电价曲线绘制
│   └── main.js                # SPA 路由与页面渲染
├── server/
│   ├── app.py                 # Flask API 后端（sqlite 模式本地验证用）
│   ├── data_import.py         # 数据导入脚本
│   └── requirements.txt       # Python 依赖
├── data/
│   ├── schema.sql             # SQLite 建表脚本
│   ├── seed.sql               # 种子数据（5省真实电价数据）
│   ├── csv/                   # CSV 数据文件
│   │   ├── regions.csv
│   │   ├── policies.csv
│   │   ├── time_periods.csv
│   │   ├── data_sources.csv
│   │   └── missing_records.csv
│   └── electricity_pricing.db # SQLite 数据库文件
├── data_source_inventory.md   # 数据源清单
├── data_dictionary.md         # 数据字典
├── known_limitations.md       # 已知限制说明
└── README.md                  # 本文件
```

## 快速启动

### 方式一：CSV 模式（默认，纯静态，兼容 IIS 和 GitHub Pages）

**无需后端服务**，直接用任意 HTTP 服务器托管根目录即可：

```bash
# Python 自带的 HTTP 服务器（本地验证）
cd 01_workbuddy
python -m http.server 8000
# 访问 http://localhost:8000
```

**部署到 IIS**：将 `01_workbuddy` 设为站点根目录，`index.html` 设为默认文档。
确保 IIS 已配置 `.csv` 文件的 MIME 类型为 `text/csv; charset=utf-8`。

**部署到 GitHub Pages**：将 `01_workbuddy/` 目录下的全部文件推送到 GitHub 仓库的 `gh-pages` 分支或 `docs/` 目录即可。

`config.json` 默认已设为 `"selected": "csv"`，页面通过 JavaScript 从 `csv.dataDir` 路径读取 CSV 文件。

### 方式二：SQLite 模式（本地完整验证）

1. 修改 `config.json` — 将 `"selected": "csv"` 改为 `"selected": "sqlite"`
2. 启动后端 API 服务：

```bash
cd 01_workbuddy/server
pip install -r requirements.txt
python app.py
# API 服务启动在 http://localhost:5000
```

3. 用 HTTP 服务器托管 `01_workbuddy` 根目录（同上），页面会自动从 API 获取数据。

### 数据初始化

数据库和 CSV 文件已预初始化。如需重新导入：

```bash
cd 01_workbuddy/server
python data_import.py
```

## SQLite / CSV 模式切换

编辑 `config.json`，修改顶层的 `selected` 字段即可：

```json
{
    "selected": "csv",              // 选 "csv" → 从 data/csv/ 读取
    "csv": { "dataDir": "data/csv/" },
    ...
}

// 切换为 sqlite 模式时：
{
    "selected": "sqlite",           // 选 "sqlite" → 调用本地 API
    "sqlite": {
        "dbPath": "data/electricity_pricing.db",
        "apiBaseUrl": "http://localhost:5000/api"
    },
    ...
}
```

切换后无需修改任何代码，页面行为完全一致。

## 已覆盖省份

| 省份 | 政策文号 | 数据来源 | 数据状态 |
|------|---------|---------|---------|
| 广东省 | 粤发改价格〔2021〕331号 | 广东省发改委 | ✅ 真实数据 |
| 江苏省 | 苏发改价格发〔2025〕426号 | 江苏省发改委 | ✅ 真实数据 |
| 山东省 | 鲁发改价格〔2022〕997号等 | 国网山东电力 | ✅ 真实数据 |
| 浙江省 | 浙发改价格〔2024〕21号 | 浙江省发改委 | ✅ 真实数据 |
| 内蒙古 | 内发改价费字〔2023〕1630号 | 内蒙古发改委 | ✅ 真实数据 |

## 数据状态标识

| 标识 | 含义 |
|------|------|
| ✅ 真实数据 | 来自政府/电网官网的公开文件，可追溯 |
| ⚠️ 示例数据 | 仅用于演示，已明确标注 |
| ❌ 缺失数据 | 经检索无法找到稳定来源，已记录检索过程 |
| 🔄 待验证 | 存在相关来源但信息不完整，需人工复核 |

## 设计说明

### 技术选型
- **前端**: 纯静态 SPA（HTML/CSS/Chart.js），无需构建工具
- **数据层**: 统一接口的 data-loader.js，支持 CSV 直接加载和 API 远程调用
- **后端**（可选）: Flask 提供 RESTful API，仅 SQLite 模式需要
- **编码**: 全站 UTF-8，无中文乱码问题
- **样式**: 深色导航 + 浅色内容，Teal 品牌色 `#00A7CB`，数据面板风格

### 数据建模
5 张表覆盖完整数据链路：行政区域 → 电价政策 → 分时时段 → 数据来源 → 缺失记录。分时时段同时保留"原始名称"和"标准分类"（尖/峰/平/谷/深谷），支持跨省对比。

## 环境要求

- **CSV 模式**: 任意 HTTP 服务器（IIS / Nginx / Python http.server）
- **SQLite 模式**: Python 3.8+，Flask（见 `server/requirements.txt`）
