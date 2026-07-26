# 数据字典

## 1. provinces.csv / provinces 表

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| province_id | TEXT | 省份代码（主键） | GD |
| province_name | TEXT | 省份全称 | 广东 |
| province_abbr | TEXT | 省份简称 | 粤 |
| region | TEXT | 地理大区 | 华南 |
| area_km2 | INTEGER | 面积（平方公里） | 179800 |
| data_status | TEXT | 数据状态（verified/pending/missing） | verified |

## 2. time_periods.csv / time_periods 表

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| period_id | INTEGER | 自增主键 | — |
| province_id | TEXT | 省份代码（外键） | GD |
| user_type | TEXT | 用户类型 | 一般工商业 |
| voltage_level | TEXT | 电压等级 | 10kV |
| season_type | TEXT | 季节类型（通用/夏季/非夏季） | 夏季 |
| period_name | TEXT | 原始时段名称 | 高峰 |
| standard_category | TEXT | 标准分类（尖/峰/平/谷/深谷） | 峰 |
| start_time | TEXT | 开始时间 (HH:MM) | 10:00 |
| end_time | TEXT | 结束时间 (HH:MM) | 12:00 |
| price_yuan_per_kwh | REAL | 电价（元/kWh） | 1.0985 |
| ratio_to_flat | REAL | 与平段基准价的比例 | 1.70 |
| source_id | TEXT | 来源编号 | SRC-GD-001 |
| notes | TEXT | 备注 | 夏季5-10月 |

## 3. sources.csv / sources 表

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| source_id | TEXT | 来源编号（主键） | SRC-GD-001 |
| province_id | TEXT | 省份代码 | GD |
| source_name | TEXT | 政策文件名称 | 广东省...峰谷分时电价政策...通知 |
| publisher | TEXT | 发布机构 | 广东省发展和改革委员会 |
| doc_number | TEXT | 文号 | 粤发改价格〔2021〕331号 |
| publish_date | TEXT | 发布时间 | 2021-08-31 |
| effective_date | TEXT | 生效时间 | 2021-10-01 |
| source_url | TEXT | 来源 URL | http://drc.gd.gov.cn/... |
| reliability | TEXT | 可信度（high/medium/pending） | high |
| collect_date | TEXT | 采集时间 | 2025-12-01 |

## 4. missing_data.csv / missing_data 表

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| missing_id | INTEGER | 自增主键 | — |
| province_id | TEXT | 省份代码 | NM |
| missing_type | TEXT | 缺失类型（数据缺口/数据精度/数据口径等） | 数据缺口 |
| missing_item | TEXT | 缺失项描述 | 蒙东电网分时电价具体价格 |
| reason | TEXT | 缺失原因说明 | 蒙东电网参照东北区域电网... |
| search_process | TEXT | 检索过程描述 | 检索了内蒙古发改委官网... |
| search_date | TEXT | 检索日期 | 2025-12-01 |

## 设计说明

1. **标准分类字段**：保留"原始时段名称"（如"高峰"）的同时增加"标准分类"字段（尖/峰/平/谷/深谷），支持检索和跨省对比。
2. **用户类型和电压等级**：因不同用户类型的电价差异较大，设计时预留了筛选支持。
3. **季节类型**：广东省分夏季（5-10月）和非夏季（11-4月），其他省份也有季节性差异。
4. **比例字段**：ratio_to_flat 记录与平段基准价的比例，便于理解各时段比价关系。
5. **数据来源追溯**：每条时段记录和缺失登记都关联到来源编号，保证可追溯性。
6. **missing_data 表**：专门登记已识别但尚未补全的数据，避免用"无数据"来表示缺失。
