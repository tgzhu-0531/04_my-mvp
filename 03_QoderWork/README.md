# 城市分时电价观察站 MVP

## 项目简介

基于官方公开数据，对 **广东、江苏、山东、浙江、内蒙古** 五省（自治区）的工商业分时电价进行采集、建模和可视化展示。用户可通过本网站查询各省分时电价政策、时段划分、价格对比，并追溯数据来源。

## 快速开始

### 方式一：静态 CS V 模式（推荐）

本方式无需后端服务，直接浏览器打开即可：

```bash
# 直接双击打开
open "F:/02_ChatGPT Work/06_XWork/03_QoderWork/index.html"

# 或通过本地 HTTP 服务启动（避免 CORS 限制）
npx serve "F:/02_ChatGPT Work/06_XWork/03_QoderWork"
# 或使用 Python
python -m http.server 8080 -d "F:/02_ChatGPT Work/06_XWork/03_QoderWork"
# 浏览器访问 http://localhost:8080
```

### 方式二：SQLite 模式（本地验证）

需要 Python 环境和 SQLite 支持：

```bash
# 1. 创建数据库
cd "F:/02_ChatGPT Work/06_XWork/03_QoderWork"
sqlite3 sql/electricity.db < sql/init.sql

# 2. 导入 CSV 数据到 SQLite
python import_csv.py

# 3. 修改 config.json 切换数据源
# 将 "dataSource": "csv" 改为 "dataSource": "sqlite"

# 4. 启动后端服务（需要 Web 服务器支持 SQLite 访问）
python -c "import sqlite3; print('SQLite 连接测试:', sqlite3.connect('sql/electricity.db').execute('SELECT COUNT(*) FROM provinces').fetchone())"
```

## 部署到 GitHub Pages

1. 将 `03_QoderWork/` 目录下所有文件推送到 GitHub 仓库
2. 在仓库 Settings > Pages 中设置源目录为 `03_QoderWork/`
3. 访问 `https://<用户名>.github.io/<仓库>/03_QoderWork/`

## 部署到 Windows IIS

1. 在 IIS 中创建网站，物理路径指向 `03_QoderWork/` 目录
2. 确保默认文档中包含 `index.html`
3. 启用静态内容 MIME 类型（.csv、.json、.md）

## 数据源切换

编辑 `config.json`：

```json
{
  "dataSource": "csv",     // "csv" 为静态模式，"sqlite" 为数据库模式
  "csv": { ... },
  "sqlite": { ... }
}
```

## 项目结构

```
03_QoderWork/
├── index.html              # 主页面（单页应用）
├── config.json             # 数据源配置文件
├── data/
│   ├── guangdong.csv       # 广东分时电价数据
│   ├── jiangsu.csv         # 江苏分时电价数据
│   ├── shandong.csv        # 山东分时电价数据
│   ├── zhejiang.csv        # 浙江分时电价数据
│   ├── innermongolia.csv   # 内蒙古分时电价数据
│   ├── sources.csv         # 数据来源记录
│   └── missing_data.csv    # 缺失数据记录
├── sql/
│   └── init.sql            # SQLite 数据库初始化脚本
├── sources.md              # 数据源清单
├── dictionary.md           # 数据字典
├── README.md               # 本文件
└── limitations.md          # 已知限制说明
```

## 技术栈

- 纯前端：HTML5 + CSS3 + JavaScript (ES6)
- 图表库：Chart.js 4.4.1 (CDN)
- 数据格式：CSV（静态模式）/ SQLite（数据库模式）
- 部署方式：GitHub Pages / Windows IIS / 任意 HTTP 服务器

## 数据覆盖

| 省份 | 时段类型 | 数据状态 | 数据来源 |
|------|----------|----------|----------|
| 广东 | 尖峰/高峰/平段/低谷 | 已收录 | 粤发改价格〔2021〕331号 + 代理购电公告 |
| 江苏 | 高峰/平段/低谷 | 已收录 | 江苏省发改委分时电价政策 |
| 山东 | 尖峰/高峰/平段/低谷/深谷 | 已收录 | 山东省发改委分时电价公告 |
| 浙江 | 尖峰/高峰/平段/低谷/深谷 | 已收录 | 浙发改价格〔2025〕112号 |
| 内蒙古 | 高峰/平段/低谷 | 已收录(部分) | 内蒙古电力集团代理购电公告 |

## 许可证

本项目为 AI Work Agent 能力验证展示项目，数据来源于各省发改委、电网公司官方公开公告。
