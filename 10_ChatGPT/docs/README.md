# 城市分时电价观察站

## 项目简介

基于《城市分时电价观察站_MVP需求文档》搭建的中国城市分时电价查询网站，覆盖 **广东、江苏、山东、浙江、内蒙古** 5 个样本省份，支持 SQLite（本地验证）和 CSV（静态展示）双数据源模式。

## 项目结构

```
10_ChatGPT/
├── index.html              # 网站首页（SPA 入口）
├── config.json             # 数据源切换配置文件
├── css/
│   └── style.css           # 全局样式表
├── js/
│   ├── config.js           # 配置加载器 + 数据加载器 + 工具函数
│   ├── chart-setup.js      # Chart.js 图表配置
│   └── app.js              # 主应用逻辑（页面渲染、导航、数据展示）
├── data/
│   ├── provinces.csv       # 省份基本信息表
│   ├── time_periods.csv    # 分时时段与电价表
│   ├── sources.csv         # 数据来源清单
│   └── missing_data.csv    # 缺失数据登记表
├── db/
│   ├── schema.sql          # SQLite 建表脚本
│   ├── seed.sql            # SQLite 种子数据
│   └── import_data.js      # CSV → SQLite 导入脚本（Node.js）
└── docs/
    ├── README.md           # 本文件（项目说明）
    ├── data_dictionary.md  # 数据字典
    ├── source_list.md      # 数据源清单
    └── known_limitations.md# 已知限制说明
```

## 启动方式

### 方式一：直接打开（CSV 模式，推荐）

支持 Windows IIS 和 GitHub Pages 静态托管环境。

1. 直接用浏览器打开 `10_ChatGPT/index.html`
2. 或部署到 IIS / GitHub Pages

> 默认启用 `csv` 数据源，无需后端服务即可展示所有数据。

### 方式二：本地 SQLite 验证（需要 Node.js）

1. 安装依赖：
```bash
cd 10_ChatGPT/db
npm install better-sqlite3
```

2. 导入数据：
```bash
node import_data.js
```

3. 启动本地 API 服务（需要额外搭建 Express 服务）
4. 修改 `config.json` 中 `dataSource` 为 `"sqlite"`

## 数据源切换

通过 `config.json` 进行切换：

```json
{
  "dataSource": "csv",        // "csv" 或 "sqlite"
  "csvConfig": { ... },
  "sqliteConfig": { ... }
}
```

- **`dataSource: "csv"`**：前端直接读取 data/ 目录下的 CSV 文件，无需后端
- **`dataSource: "sqlite"`**：前端通过 API 接口访问 SQLite 数据库

切换后刷新页面即可生效，无需修改网站代码。

## 数据说明

### 当前覆盖省份

| 省份 | 代码 | 电网 | 数据状态 |
|------|------|------|----------|
| 广东 | GD | 南方电网 | ✅ 已收录 |
| 江苏 | JS | 国家电网 | ✅ 已收录 |
| 山东 | SD | 国家电网 | ✅ 已收录 |
| 浙江 | ZJ | 国家电网 | ✅ 已收录 |
| 内蒙古 | NM | 蒙西/蒙东电网 | ✅ 已收录 |

### 数据口径

- **用户类型**：一般工商业 10kV
- **价格单位**：元/kWh
- **政策来源**：省级发展改革委官方政策文件

具体价格基于政策文件中的峰谷比价和公开的平段基准价计算得出，以各省最新公布代理购电价格表为准。

## 需人工复核的项目

详见 `docs/known_limitations.md` 和 `data/missing_data.csv`。

## 数据库初始化

执行 `db/schema.sql` 创建表结构，然后执行 `db/seed.sql` 插入种子数据。

Node.js 环境也可运行：
```bash
cd 10_ChatGPT/db
npm install better-sqlite3
node import_data.js
```
