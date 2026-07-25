# 数据字典

## 概述

本数据字典描述城市分时电价观察站 MVP 的数据库设计和 CSV 文件结构。

数据库包含 4 张表，CSV 文件与之一一对应。

## 1. provinces（行政区域表）

存储省级行政区域信息。

| 字段名 | 数据类型 | 说明 | 示例 |
|--------|---------|------|------|
| id | INTEGER | 主键 | 1 |
| province_code | TEXT | 省份行政区划代码 | "44" |
| province_name | TEXT | 省份名称 | "广东省" |
| region | TEXT | 适用区域描述 | "广东全省" |
| grid_company | TEXT | 供电电网公司 | "广东电网有限责任公司" |
| region_note | TEXT | 区域备注 | "全省统一执行" |

**设计说明**: 内蒙古因蒙西电网和蒙东电网分属不同电网公司且电价政策不同，拆分为两条记录。

## 2. sources（数据来源表）

存储每条电价数据的权威来源信息。

| 字段名 | 数据类型 | 说明 | 示例 |
|--------|---------|------|------|
| id | INTEGER | 主键 | 1 |
| source_name | TEXT | 来源名称（含政策文号） | "广东省峰谷分时电价政策（粤发改价格〔2021〕331号）" |
| source_url | TEXT | 来源 URL | "https://drc.gd.gov.cn/..." |
| issuing_authority | TEXT | 发布机构 | "广东省发展改革委" |
| publish_date | TEXT | 发布日期 | "2021-10-01" |
| collect_date | TEXT | 采集日期 | "2026-07-25" |
| reliability | TEXT | 可靠性等级 | "高" |
| notes | TEXT | 备注说明 | "省级发改委官网确认现行有效" |

**设计说明**: 来源表独立于电价数据，支持一条来源关联多条电价记录，实现一对多关系。

## 3. price_policies（分时电价政策表）

存储分时电价的具体时段和价格信息。

| 字段名 | 数据类型 | 说明 | 示例 |
|--------|---------|------|------|
| id | INTEGER | 主键 | 24 |
| province_id | INTEGER | 外键，关联 provinces.id | 3 |
| season_type | TEXT | 季节类型 | "全年"、"夏冬两季（6-8月/12-2月）" |
| user_type | TEXT | 用户类型 | "工商业"、"工商业（代理购电用户）" |
| voltage_level | TEXT | 电压等级 | "1-10千伏"、"35千伏" |
| original_period_name | TEXT | 原始时段名称 | "高峰"、"尖峰"、"低谷"、"深谷" |
| standard_category | TEXT | 标准分类 | "尖峰"、"峰"、"平"、"谷"、"深谷" |
| start_time | TEXT | 时段起始时间 | "17:00" |
| end_time | TEXT | 时段结束时间 | "20:00" |
| price_yuan_kwh | REAL | 电价（元/kWh），可能为空 | 1.20 |
| price_basis | TEXT | 价格基准/浮动比例说明 | "以平段0.71元/kWh为基准上浮约69%" |
| source_id | INTEGER | 外键，关联 sources.id | 3 |
| policy_effective_date | TEXT | 政策生效日期 | "2024-01-01" |
| policy_expire_date | TEXT | 政策失效日期，可为空 | NULL |
| data_status | TEXT | 数据状态 | "真实数据" |
| caliber_note | TEXT | 口径说明 | "山东省2025年4月示例" |

**设计说明**:
- `original_period_name` 保留各省原始命名，如广东称"高峰"而山东称"高峰"
- `standard_category` 统一映射为标准分类，便于跨省对比
- `price_yuan_kwh` 可为空：部分省份采用浮动比例机制，无固定电价数值
- `price_basis` 在无固定电价时提供浮动比例信息
- 一条电价政策可能产生多条时段记录（如峰、平、谷各一条）

## 4. missing_data（缺失数据记录表）

记录无法获取的数据项及其原因。

| 字段名 | 数据类型 | 说明 | 示例 |
|--------|---------|------|------|
| id | INTEGER | 主键 | 1 |
| province_id | INTEGER | 外键，关联 provinces.id | 1 |
| missing_field | TEXT | 缺失字段名称 | "具体到户电价数值" |
| reason | TEXT | 缺失原因 | "代理购电价格按月浮动" |
| search_effort | TEXT | 已做的检索努力 | "已检索粤发改价格〔2021〕331号原文" |
| next_step | TEXT | 下一步建议 | "可访问南网在线APP获取月度价格" |

**设计说明**: PRD 要求"找不到来源的数据必须被明确标注为缺失"，此表用于透明记录所有缺失项。

## 表关系

```
provinces (1) ──── (N) price_policies (N) ──── (1) sources
provinces (1) ──── (N) missing_data
```

- 一个省份有多条电价政策记录
- 多条电价政策可关联同一个数据来源
- 一个省份有多条缺失数据记录

## 索引

- `idx_price_province`: 按 province_id 查询电价
- `idx_price_season`: 按 season_type 筛选
- `idx_price_user_type`: 按 user_type 筛选
- `idx_price_category`: 按 standard_category 筛选
- `idx_missing_province`: 按 province_id 查询缺失数据

## CSV 文件编码

所有 CSV 文件使用 UTF-8 编码，逗号分隔，首行为表头。
