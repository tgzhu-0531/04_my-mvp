# 城市分时电价观察站 MVP

## 项目简介

城市分时电价观察站是一个展示中国重点省份分时电价政策和价格数据的可视化平台，支持广东、江苏、山东、浙江、内蒙古5个省区的分时电价查询与对比分析。

## 项目目标

- 集中展示5个重点省份的分时电价政策
- 支持多维度数据筛选（省份、用户类型、季节等）
- 提供直观的价格对比图表
- 追溯每条数据的来源和可信度
- 清晰标注数据缺失情况和限制

## 技术栈

- **前端**：原生 HTML5 + CSS3 + JavaScript (ES6+)
- **图表**：Chart.js (CDN)
- **数据格式**：CSV / SQLite
- **后端**（可选）：Python 3 (用于 SQLite 模式)
- **部署**：支持静态部署（GitHub Pages / IIS）

## 项目结构

```
01_PriceObservatory/
├── config.json                  # 数据源配置文件
├── README.md                    # 本文件
├── glossary.md                  # 术语表
├── data_source_manifest.md      # 数据源清单
├── known_issues.md              # 已知限制
├── database/
│   ├── init.sql                 # 数据库初始化脚本
│   └── seed.sql                 # 数据初始化脚本
├── server/
│   └── api.py                   # SQLite 模式 API 服务（Python）
├── site/
│   ├── index.html               # 主网站页面
│   ├── css/
│   │   └── style.css            # 样式文件
│   ├── js/
│   │   ├── app.js               # 主应用逻辑
│   │   ├── csv-adapter.js       # CSV 数据适配器
│   │   └── sqlite-adapter.js    # SQLite 数据适配器
│   └── data/
│       ├── provinces.csv        # 省份数据
│       ├── tariff_types.csv     # 电价类型数据
│       ├── prices.csv           # 电价数据
│       └── data_sources.csv     # 数据源数据
└── scripts/
    └── csv_to_sqlite.py         # CSV 转 SQLite 工具脚本
```

## 数据源切换

本项目支持两种数据源模式：**CSV 模式**（默认）和 **SQLite 模式**。

### CSV 模式（默认）
- 适合静态部署（GitHub Pages、IIS 等）
- 前端直接读取静态 CSV 文件
- 无需后端服务
- 配置文件 `config.json` 中 `dataSource` 设为 `"csv"`

### SQLite 模式
- 适合本地动态验证
- 需要运行 Python API 服务
- 配置文件 `config.json` 中 `dataSource` 设为 `"sqlite"`

#### 启动 SQLite 模式

```bash
# 1. 初始化数据库
cd database
sqlite3 electricity_prices.db < init.sql
sqlite3 electricity_prices.db < seed.sql

# 2. 启动 API 服务
cd ../server
python api.py
```

## 数据初始化

### 方法一：从 CSV 导入 SQLite

```bash
python scripts/csv_to_sqlite.py --csv-dir site/data/ --db database/electricity_prices.db
```

### 方法二：直接运行 SQL 脚本

```bash
sqlite3 database/electricity_prices.db < database/init.sql
sqlite3 database/electricity_prices.db < database/seed.sql
```

## 部署方式

### GitHub Pages 部署（推荐）

1. 将 `site/` 目录内容上传到 GitHub Pages 仓库
2. 确保 `config.json` 的 `dataSource` 设为 `"csv"`
3. 访问 `https://<用户名>.github.io/<仓库名>/site/`

### Windows IIS 部署

1. 在 IIS 中创建新站点，指向 `01_PriceObservatory/site/` 目录
2. 确保 IIS 配置了 UTF-8 编码
3. 确认 MIME 类型包含 `.csv`（text/csv）和 `.json`（application/json）

## 覆盖数据范围

| 省份 | 价格类型 | 季节覆盖 | 数据状态 |
|------|---------|---------|---------|
| 广东省 | 一般工商业 1-10kV | 夏季/非夏季 | ✅ 已验证 |
| 江苏省 | 一般工商业 1-10kV | 全年统一 | ✅ 已验证 |
| 山东省 | 一般工商业 1-10kV | 夏季/冬季 | ✅ 已验证 |
| 浙江省 | 一般工商业 1-10kV | 全年统一 | ✅ 已验证 |
| 内蒙古 | 一般工商业 1-10kV | 全年统一 | ✅ 已验证 |

## 注意事项

1. 所有数据来自省级发改委和电网公司官方公告，采集日期为 2025-07-01
2. 实际执行价格可能因月度浮动与公布价格略有差异
3. 本 MVP 仅包含一般工商业用户 1-10kV 电压等级数据
4. 详细的数据限制请参见 `known_issues.md`

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2025-07-27 | MVP 初始版本，覆盖5省分时电价数据 |

## 许可证

本项目数据来源于政府公开文件，仅供研究参考。
