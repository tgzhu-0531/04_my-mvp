# 数据字典

## 表名：regions（行政区域）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 主键 | 1 |
| code | VARCHAR(20) | 行政区划代码 | 440000 |
| name | VARCHAR(100) | 名称 | 广东省 |
| level | TINYINT | 层级（1=省 2=市 3=区县） | 1 |
| parent_id | INTEGER | 上级区域ID（省级为NULL） | NULL |
| province_code | VARCHAR(20) | 所属省份代码 | 440000 |

## 表名：policies（电价政策）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| region_id | INTEGER | 适用地区（关联 regions） |
| title | VARCHAR(255) | 政策标题 |
| policy_doc_number | VARCHAR(100) | 政策文号 |
| user_type | VARCHAR(50) | 用户类型（工商业/大工业/一般工商业/居民/农业） |
| voltage_level | VARCHAR(50) | 电压等级 |
| season_type | VARCHAR(50) | 季节类型（全年/夏冬季/春秋季/大风季等） |
| flat_price | DECIMAL(10,5) | 平段电价（元/kWh） |
| price_unit | VARCHAR(20) | 电价单位（默认 元/kWh） |
| effective_date | DATE | 生效日期 |
| expiry_date | DATE | 失效日期（NULL=仍有效） |
| source_id | INTEGER | 数据来源ID |
| notes | TEXT | 备注/口径说明 |
| data_type | VARCHAR(20) | 数据类型（real=真实, sample=示例） |

## 表名：time_periods（分时时段）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| policy_id | INTEGER | 关联政策 |
| region_id | INTEGER | 适用地区 |
| season_type | VARCHAR(50) | 季节类型 |
| original_name | VARCHAR(50) | 原始时段名称（如"高峰"） |
| standard_category | VARCHAR(20) | 标准分类（尖峰/高峰/平段/低谷/深谷） |
| start_time | TIME | 开始时间 |
| end_time | TIME | 结束时间 |
| price | DECIMAL(10,5) | 电价（元/kWh，NULL=按浮动比例） |
| float_ratio | DECIMAL(5,2) | 浮动比例（相对于平段） |
| user_type | VARCHAR(50) | 适用用户类型 |
| voltage_level | VARCHAR(50) | 适用电压等级 |
| data_type | VARCHAR(20) | 数据类型 |

## 表名：data_sources（数据来源）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| source_name | VARCHAR(255) | 来源名称 |
| source_url | VARCHAR(500) | 来源URL |
| publish_authority | VARCHAR(255) | 发布机构 |
| publish_date | DATE | 发布时间 |
| collect_date | DATE | 采集时间 |
| reliability | VARCHAR(50) | 可信度（high/medium/low/unverified） |
| doc_type | VARCHAR(50) | 文档类型（PDF/网页/公告） |
| notes | TEXT | 备注 |

## 表名：missing_records（缺失数据记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| province | VARCHAR(100) | 省份 |
| city | VARCHAR(100) | 城市 |
| user_type | VARCHAR(50) | 用户类型 |
| data_field | VARCHAR(100) | 缺失的数据字段 |
| search_process | TEXT | 检索过程说明 |
| search_keywords | TEXT | 检索关键词 |
| searched_urls | TEXT | 已检索URL列表 |
| judgment_basis | TEXT | 无法找到的判断依据 |
| status | VARCHAR(20) | 状态（missing/unverified/pending） |
