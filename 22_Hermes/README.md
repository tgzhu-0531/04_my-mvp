# 城市分时电价观察站 MVP

## 项目简介

中国城市分时电价观察站 MVP，用于展示广东、江苏、山东、浙江、内蒙古 5 个样本省份的分时电价政策、时段结构、价格曲线和数据来源。

本项目验证了一个完整工作链路：从本地 PRD 读取 → 公开资料检索 → 数据建模 → 数据库初始化 → 网站搭建 → 交付说明。

## 项目结构

```
22_Hermes/
├── index.html              # 网站首页（默认入口）
├── config.json              # 数据源配置文件
├── data/
│   ├── csv/                 # CSV 数据文件（静态模式）
│   │   ├── tou_rates_flat.csv          # 平铺分时电价数据
│   │   ├── data_sources_flat.csv       # 数据来源
│   │   ├── missing_records_flat.csv    # 缺失数据
│   │   ├── province_summary.csv        # 省份汇总
│   │   └── ... (其他规范化表)
│   └── sqlite/
│       └── electricity_pricing.db      # SQLite 数据库文件
├── src/
│   ├── css/
│   │   └── style.css        # 网站样式
│   └── js/
│       └── app.js           # 网站逻辑（含嵌入式 fallback 数据）
├── scripts/
│   ├── init_db.py           # 数据库初始化脚本
│   ├── generate_site.py     # 网站文件生成脚本
│   └── api_server.py        # SQLite 数据接口服务（本地验证用）
├── docs/
│   ├── 数据字典.md           # 数据字典
│   ├── 数据源清单.md          # 数据源清单
│   ├── README.md            # 本文件
│   └── 已知限制.md           # 已知限制说明
└── README.md                # 项目根 README
```

## 快速启动

### 方式一：CSV 模式（推荐，无需后端）

1. 直接用浏览器打开 `index.html`
2. 数据从 `data/csv/` 目录下的 CSV 文件读取
3. 本模式适用于 Windows IIS 或 GitHub Pages 静态托管

### 方式二：SQLite 模式（本地完整验证）

1. 初始化数据库：
   ```bash
   cd 22_Hermes
   python scripts/init_db.py
   ```

2. 启动数据接口服务：
   ```bash
   python scripts/api_server.py
   ```

3. 修改 `config.json` 中的 `dataSource` 为 `"sqlite"`
4. 通过本地 HTTP 服务访问页面（如 `python -m http.server 8080`），或直接用浏览器打开 `index.html`（需处理 CORS）

## 数据源切换

编辑项目根目录下的 `config.json` 文件：

```json
{
  "dataSource": "csv",   // 改为 "sqlite" 切换
  ...
}
```

**CSV 模式**：前端直接读取 CSV 文件，无需后端。
**SQLite 模式**：前端通过 API 服务（http://localhost:8080/api）读取数据库，需先运行 `scripts/api_server.py`。

两种模式下，页面展示、筛选查询、来源追溯和缺失数据说明的行为保持一致。

## 数据库初始化

```bash
cd 22_Hermes
python scripts/init_db.py
```

此脚本会：
1. 创建 SQLite 数据库 `data/sqlite/electricity_pricing.db`
2. 创建 6 张数据表（regions, policies, time_periods, data_sources, data_source_links, missing_records）
3. 插入 5 个样本省份的分时电价数据
4. 导出所有 CSV 文件到 `data/csv/`
5. 导出平铺数据文件供前端使用

## 覆盖省份和数据来源

| 省份 | 数据状态 | 数据来源 |
|------|---------|---------|
| 广东省 | ✅ 完整（夏季+非夏季） | 广东省发改委、广东电网 |
| 江苏省 | ✅ 完整（夏季+非夏季） | 江苏省发改委、国网江苏 |
| 山东省 | ✅ 完整 | 山东省发改委、国网山东 |
| 浙江省 | ✅ 完整（夏季+非夏季） | 浙江省发改委、国网浙江 |
| 内蒙古 | ⚠️ 蒙西电网（蒙东待验证） | 内蒙古发改委、内蒙古电力集团 |

具体来源 URL 和可靠性评估详见 [docs/数据源清单.md](docs/数据源清单.md)。

## 数据口径

- **用户类型**：工商业用户（1-10kV）
- **电价单位**：元/kWh
- **时段分类**：尖峰、高峰、平段、低谷、深谷
- **季节类型**：夏季（5-10月）、非夏季（11月-次年4月）
- **价格构成**：含电度电价和输配电价

## 技术栈

- **前端**：纯 HTML + CSS + JavaScript（无框架依赖）
- **图表**：Canvas API 手绘
- **数据存储**：SQLite / CSV
- **编码**：UTF-8（所有文件）

## 部署要求

### GitHub Pages
1. 将 `22_Hermes/` 目录推送到 GitHub 仓库
2. 在仓库 Settings > Pages 中设置为部署目录
3. `config.json` 中的 `dataSource` 需设为 `"csv"`

### Windows IIS
1. 在 IIS 中创建站点，指向 `22_Hermes/` 目录
2. 确保启用静态文件服务和 UTF-8 编码
3. `config.json` 中的 `dataSource` 需设为 `"csv"`

## 许可证

本项目仅供研究参考，数据版权归各发布机构所有。
