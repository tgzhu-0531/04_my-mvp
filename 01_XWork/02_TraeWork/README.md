# 城市分时电价观察站 - TRAE Work 版本

## 项目概述

基于《城市分时电价观察站_MVP需求文档.pdf》搭建的分时电价信息展示网站，覆盖广东、江苏、山东、浙江、内蒙古 5 个样本省份的工商业分时电价政策、时段结构和价格数据。

## 项目结构

```
02_TraeWork/
├── index.html              # 主页面（单页应用）
├── config.json             # 数据源配置文件
├── css/
│   └── style.css           # 样式表
├── js/
│   ├── config.js           # 配置加载模块
│   ├── data-loader.js      # 数据加载模块（CSV/SQLite 双模式）
│   ├── chart.js            # 图表绘制模块（Chart.js）
│   └── app.js              # 主应用逻辑
├── data/
│   ├── csv/                # CSV 数据文件
│   │   ├── regions.csv         # 行政区域
│   │   ├── data_sources.csv    # 数据来源
│   │   ├── policies.csv        # 电价政策
│   │   ├── periods.csv         # 分时时段
│   │   └── missing_records.csv # 缺失记录
│   └── sql/
│       └── 01_init.sql         # 数据库初始化 SQL
├── server/
│   ├── package.json         # Node.js 依赖
│   ├── server.js            # Express API 服务
│   └── db.js                # SQLite 数据库访问层
└── scripts/
    ├── import_csv_to_sqlite.py  # CSV → SQLite 导入
    └── export_sqlite_to_csv.py  # SQLite → CSV 导出
```

## 启动方式

### 方式一：CSV 模式（静态展示，推荐）

适用于 Windows IIS、GitHub Pages 等静态站点环境。

1. 确保 `config.json` 中 `dataSource` 为 `"csv"`
2. 使用本地 HTTP 服务器启动（必须，浏览器禁止直接读取本地 CSV 文件）：
   - Python: `python -m http.server 8080`（在项目根目录 `02_TraeWork` 下执行）
   - Node.js: `npx http-server -p 8080`
   - VS Code: 安装 Live Server 插件，右键 `index.html` 选择 "Open with Live Server"
3. 访问 `http://localhost:8080`

### 方式二：SQLite 模式（本地完整验证）

适用于需要数据库验证的场景。

1. 安装 Python 依赖：`pip install -r requirements.txt`（如需要）
2. 初始化数据库：`cd scripts && python import_csv_to_sqlite.py`
3. 安装 Node.js 依赖：`cd server && npm install`
4. 启动服务：`cd server && npm start`
5. 修改 `config.json` 中 `dataSource` 为 `"sqlite"`
6. 访问 `http://localhost:3456`

## 数据源切换方式

1. 打开 `config.json`
2. 将 `dataSource` 字段改为 `"csv"` 或 `"sqlite"`
3. 刷新页面即可生效（无需重启服务）

## 数据初始化

### CSV → SQLite

```bash
cd scripts
python import_csv_to_sqlite.py
```

### SQLite → CSV（导出）

```bash
cd scripts
python export_sqlite_to_csv.py
```

## 当前覆盖省份

| 省份 | 区域编码 | 政策数 | 时段数 | 数据来源数 |
|------|---------|-------|--------|-----------|
| 广东 | GD | 2 | 9 | 2 |
| 江苏 | JS | 2 | 9 | 2 |
| 山东 | SD | 2 | 23 | 2 |
| 浙江 | ZJ | 2 | 15 | 1 |
| 内蒙古 | NM | 2 | 15 | 2 |

## 数据来源

所有数据均来自省级发改委官网、国家电网代理购电公告、地方政府官网。详见 `DATA_SOURCES.md` 和 `data/csv/data_sources.csv`。

## 数据口径

- 以工商业分时电价为主，居民电价仅作参考展示
- 电价单位统一为元/kWh，含税含基金附加
- 时段分类统一使用"尖峰/峰/平/谷/深谷"五级标准分类
- 价格数据来自各省级电力公司代理购电公告中的代表性月度价格

## 需人工复核的项

1. 江苏精确平段基价未找到省级统一官方发布，当前使用 0.80 元/kWh 作为参考值
2. 广东尖峰电价仅7-9月且当日最高气温≥35℃时执行，展示价格为尖峰时段价格
3. 山东省实际月度价格因代理购电价格波动会略有不同
4. 蒙西电网代表内蒙古，蒙东电网时段划分不同但未单独建模