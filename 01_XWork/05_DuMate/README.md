# 城市分时电价观察站 MVP - DuMate 版本

## 项目简介

本项目是一个"中国城市分时电价观察站"MVP，展示广东、江苏、山东、浙江、内蒙古 5 个用电量较大省份的工商业分时电价政策、时段结构、价格曲线和数据来源。

所有电价数据均来自省级发展改革委官网公开发布的政策文件，每条数据可追溯至原始来源。

## 项目结构

```
05_DuMate/
├── index.html                  # 网站首页（默认入口）
├── config.json                 # 数据源配置文件
├── assets/
│   ├── css/
│   │   └── style.css           # 主样式表
│   └── js/
│       ├── data.js             # 数据访问层（CSV/SQLite 双模式）
│       └── app.js              # 主应用逻辑
├── data/                        # CSV 数据文件（静态展示模式）
│   ├── provinces.csv           # 行政区域表
│   ├── sources.csv             # 数据来源表
│   ├── price_policies.csv      # 分时电价政策表
│   └── missing_data.csv        # 缺失数据记录表
├── database/                    # SQLite 数据库相关
│   ├── init_db.sql              # SQLite 初始化 SQL 脚本
│   ├── init_database.py         # 数据库初始化 Python 脚本
│   ├── export_csv.py            # CSV 导出脚本
│   └── electricity_pricing.db   # SQLite 数据库文件（初始化后生成）
├── server/
│   └── sqlite_server.py         # SQLite HTTP API 服务
└── docs/
    ├── DATA_DICTIONARY.md       # 数据字典
    ├── DATA_SOURCES.md          # 数据源清单
    └── KNOWN_LIMITATIONS.md     # 已知限制说明
```

## 快速启动

### 方式一: CSV 静态模式（默认，最简单）

1. 打开 `config.json`，确认 `dataSource` 为 `"csv"`
2. 用浏览器直接打开 `index.html`，或部署到 IIS / GitHub Pages

```bash
# 本地直接打开
start index.html

# 或用 Python 简易服务器
python -m http.server 8080
# 然后访问 http://localhost:8080
```

### 方式二: SQLite 完整模式（本地验证）

1. 初始化数据库:
```bash
cd database
python init_database.py
```

2. 打开 `config.json`，将 `dataSource` 改为 `"sqlite"`

3. 启动 SQLite API 服务:
```bash
cd server
python sqlite_server.py
```

4. 用浏览器打开 `index.html`（需通过 HTTP 服务器访问，不能直接双击文件）

```bash
# 在项目根目录启动简易服务器
python -m http.server 8080
# 访问 http://localhost:8080
```

## 数据源切换

编辑 `config.json` 文件:

```json
{
  "dataSource": "csv"    // 改为 "sqlite" 切换到数据库模式
}
```

- `csv` 模式: 前端直接读取 `data/` 目录下的 CSV 文件，无需后端服务
- `sqlite` 模式: 前端通过 `http://localhost:3000` 的 API 读取 SQLite 数据库

两种模式下页面展示、筛选查询、来源追溯行为完全一致。

## SQLite 初始化

```bash
cd database
python init_database.py
```

执行后会:
1. 创建 `electricity_pricing.db` 数据库文件
2. 创建 4 张表: provinces、sources、price_policies、missing_data
3. 导入全部真实电价数据
4. 输出数据统计

## CSV 导出

如需从 SQLite 数据库重新导出 CSV:

```bash
cd database
python export_csv.py
```

## 当前覆盖省份和来源

| 省份 | 政策文号 | 来源 |
|------|---------|------|
| 广东 | 粤发改价格〔2021〕331号 | 广东省发展改革委官网 |
| 江苏 | 苏发改价格发〔2025〕426号 | 江苏省发展改革委官网 |
| 山东 | 鲁发改价格〔2023〕914号 + 新闻发布会 | 山东省发改委官网 |
| 浙江 | 浙发改价格〔2026〕112号 | 浙江省政府门户网站 |
| 内蒙古（蒙西） | 自治区发改委文件 | 阿拉善盟政府官网转载 |
| 内蒙古（蒙东） | 内发改价费字〔2023〕1631号 | 内蒙古自治区发改委官网 |

## 技术栈

- 前端: HTML5 + CSS3 + 原生 JavaScript（无框架依赖）
- 图表: Chart.js 4.4 (CDN)
- 数据库: SQLite 3
- 后端: Python 标准库 http.server（无第三方依赖）
- 编码: 全部文件 UTF-8

## 部署说明

### Windows IIS 部署

1. 将 `05_DuMate` 目录设为 IIS 站点根目录
2. 确保 `config.json` 中 `dataSource` 为 `"csv"`
3. 添加 MIME 类型（如需）: `.json` -> `application/json`, `.csv` -> `text/csv`
4. 访问站点即可

### GitHub Pages 部署

1. 将 `05_DuMate` 目录内容推送到 GitHub 仓库
2. 在仓库设置中启用 GitHub Pages
3. 确保 `config.json` 中 `dataSource` 为 `"csv"`
4. 访问 GitHub Pages URL 即可

## 数据状态

- 真实数据: 71 条分时电价时段记录
- 数据来源: 8 条权威来源（均来自省级发改委官网）
- 缺失数据: 10 条（已标注原因和下一步建议）
- 所有数据采集日期: 2026-07-25
