# 数据字典

> 城市分时电价观察站 MVP 数据库/CSV 数据字典

---

## 1. regions (行政区域表)

存储省、市两级行政区域信息。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 主键 | 1 |
| code | TEXT | 区域编码（唯一） | GD |
| name | TEXT | 区域名称 | 广东省 |
| province_id | TEXT | 所属省编码 | GD |
| province_name | TEXT | 所属省名称 | 广东省 |
| level | TEXT | 层级：province/city | province |
| parent_id | INTEGER | 父级区域 ID（预留区县） | NULL |

**设计说明**：包含省、市两级，预留区县级 (level=district) 支持未来扩展。code 字段使用拼音缩写便于前端识别。

---

## 2. policies (电价政策表)

存储各省的电价政策文件信息。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 主键 | 1 |
| region_id | INTEGER | 适用区域 ID | 1 |
| user_type | TEXT | 用户类型 | 大工业用电 |
| voltage_level | TEXT | 电压等级 | 10kV及以上 |
| season_type | TEXT | 适用季节 | 夏季 |
| policy_title | TEXT | 政策标题 | 广东省关于2025年电力市场交易... |
| policy_number | TEXT | 文号 | 粤发改能源〔2024〕号 |
| publish_date | TEXT | 发布日期 | 2024-11-22 |
| effective_date | TEXT | 生效日期 | 2025-01-01 |
| expiry_date | TEXT | 失效日期 | NULL |
| source_id | INTEGER | 来源 ID | 1 |
| data_status | TEXT | 数据状态 | confirmed |
| notes | TEXT | 备注 | 广东夏季尖峰上浮25% |

**设计说明**：同一省份可能有多条政策对应不同用户类型和季节，所以按 region_id + user_type + season_type 组合区分。data_status 用于区分真实数据（confirmed）和推算值（modeled/estimated）。

---

## 3. time_periods (分时时段表)

存储每条政策下的具体分时时段划分。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 主键 | 1 |
| policy_id | INTEGER | 所属政策 ID | 1 |
| original_name | TEXT | 原始时段名称 | 尖峰 |
| standard_category | TEXT | 标准分类（尖峰/峰/平/谷/深谷） | 尖峰 |
| start_time | TEXT | 起始时间 (HH:MM) | 11:00 |
| end_time | TEXT | 结束时间 (HH:MM) | 12:00 |
| season_type | TEXT | 适用季节 | 夏季 |
| price_value | REAL | 电价 (元/kWh) | 0.9213 |
| price_unit | TEXT | 电价单位 | 元/kWh |
| data_status | TEXT | 数据状态 | modeled |
| notes | TEXT | 备注/计算说明 | 基于平段0.63+尖峰上浮25% |

**设计说明**：同时保留"原始时段名称"（各地叫法可能不同）和"标准分类"（统一为尖峰/峰/平/谷/深谷 5 类）以支持口径统一和灵活展示。

---

## 4. price_points (价格曲线数据表)

按小时粒度存储 24 小时价格数据，用于绘制曲线图。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 主键 | 1 |
| region_id | INTEGER | 区域 ID | 1 |
| user_type | TEXT | 用户类型 | 大工业用电 |
| season_type | TEXT | 季节类型 | 夏季 |
| hour | INTEGER | 小时 (0-23) | 0 |
| standard_category | TEXT | 标准分类 | 谷 |
| price_value | REAL | 电价 (元/kWh) | 0.3465 |
| data_status | TEXT | 数据状态 | modeled |

**设计说明**：预计算 24 小时价格点存入此表，避免前端每次渲染时做复杂计算。对于没有 24 小时全量数据的省份，使用时段划分数据均摊填充。

---

## 5. sources (数据来源表)

存储每条数据的原始来源信息。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 主键 | 1 |
| source_name | TEXT | 来源名称 | 广东省2025年电力市场化交易通知 |
| source_url | TEXT | 来源 URL | https://... |
| publish_org | TEXT | 发布机构 | 广东省能源局 |
| publish_date | TEXT | 发布时间 | 2024-11-22 |
| collect_date | TEXT | 采集时间 | 2026-07-26 |
| reliability | TEXT | 可靠性 (high/medium/low) | high |
| notes | TEXT | 备注 | 转载来源 |

---

## 6. missing_data (缺失数据记录表)

记录已检索但未找到的数据项。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 主键 | 1 |
| region_id | INTEGER | 关联区域 ID | 1 |
| description | TEXT | 缺失数据描述 | 广州市居民分时电价时段划分 |
| missing_fields | TEXT | 缺失的具体字段 | 时段划分、价格 |
| reason | TEXT | 缺失原因 | 未检索到官方详细文件 |
| search_process | TEXT | 检索过程说明 | 检索了省/市发改委、南网官网 |
| created_at | TEXT | 记录时间 | 2026-07-26 |

---

## 数据状态说明

| 状态值 | 含义 |
|--------|------|
| confirmed | 数据可直接从来源文档中确认，准确度高 |
| modeled | 基于官方浮动比例和参考基价推算（如：峰=平×1.17） |
| estimated | 估算值，基于行业平均值或相邻地区类比 |
| missing | 经检索未找到任何可验证的公开来源 |
| pending | 已找到来源但数据尚未完成结构化整理 |
