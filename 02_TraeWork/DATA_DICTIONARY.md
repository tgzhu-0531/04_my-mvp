# 数据字典

## 数据库设计说明

数据库采用 SQLite 关系型数据库，由 5 张核心表组成：

### 设计原则

1. **可追溯性**: 每一条电价数据都通过 `source_id` 外键关联到 `data_sources` 表，确保可追溯到原始公开来源
2. **标准化**: 不同省份的时段名称（如"高峰"、"峰期"、"峰段"）统一映射到标准分类（尖峰/峰/平/谷/深谷）
3. **完整性**: 无法检索到的数据项记录在 `missing_records` 表中，并说明检索过程和判断依据
4. **灵活性**: 支持省-市-区三级行政区域，并可通过 `season_type` 支持季节性时段调整

---

## 表结构

### 1. regions（行政区域表）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| region_id | TEXT PK | 区域编码 | GD, GD_GZ, JS |
| province | TEXT NOT NULL | 省份名称 | 广东 |
| city | TEXT | 城市名称 | 广州 |
| district | TEXT | 区县名称 | — |
| region_type | TEXT NOT NULL | 区域类型 | province/city/district |
| region_level | INTEGER NOT NULL | 层级 | 1=省 2=市 3=区县 |
| province_code | TEXT | 行政区划代码 | 440000 |

### 2. data_sources（数据来源表）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| source_id | TEXT PK | 来源编码 | GD_2021_331 |
| source_name | TEXT NOT NULL | 来源名称 | 广东省...通知 |
| source_url | TEXT NOT NULL | 来源URL | http://drc.gd.gov.cn/... |
| issuing_authority | TEXT NOT NULL | 发布机构 | 广东省发展改革委 |
| publish_date | TEXT NOT NULL | 发布时间 | 2021-09-10 |
| collect_date | TEXT NOT NULL | 采集时间 | 2026-07-25 |
| reliability | TEXT NOT NULL | 可靠性 | 高/中/低 |
| notes | TEXT | 备注 | 省发改委官网 |

### 3. policies（电价政策表）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| policy_id | TEXT PK | 政策编码 | GD_COMM_1 |
| region_id | TEXT FK | 适用区域 | GD |
| user_type | TEXT NOT NULL | 用户类型 | 工商业/居民/农业 |
| voltage_level | TEXT NOT NULL | 电压等级 | 不满1千伏 |
| season_type | TEXT NOT NULL | 季节类型 | 全年/夏冬季/春秋季 |
| policy_name | TEXT NOT NULL | 政策名称 | 广东省峰谷分时电价政策 |
| flat_price | REAL | 平段电价 | 0.4530 |
| peak_ratio | REAL | 峰段比价系数 | 1.70 |
| valley_ratio | REAL | 谷段比价系数 | 0.38 |
| peak_price | REAL | 峰段电价 | 0.7701 |
| valley_price | REAL | 谷段电价 | 0.1721 |
| sharp_price | REAL | 尖峰电价 | 0.9626 |
| deep_valley_price | REAL | 深谷电价 | — |
| effective_date | TEXT | 生效日期 | 2021-10-01 |
| expiry_date | TEXT | 失效日期 | — |
| source_id | TEXT FK | 数据来源 | GD_2021_331 |
| notes | TEXT | 备注 | 峰平谷比价1.7:1:0.38 |

### 4. periods（分时时段表）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| period_id | TEXT PK | 时段编码 | GD_P1 |
| policy_id | TEXT FK | 关联政策 | GD_COMM_1 |
| region_id | TEXT FK | 适用区域 | GD |
| season_type | TEXT NOT NULL | 季节类型 | 全年 |
| std_category | TEXT NOT NULL | 标准分类 | 尖峰/峰/平/谷/深谷 |
| original_name | TEXT NOT NULL | 原始名称 | 尖峰 |
| start_time | TEXT NOT NULL | 开始时间 | 11:00 |
| end_time | TEXT NOT NULL | 结束时间 | 12:00 |
| price | REAL | 电价 | 0.9626 |
| source_id | TEXT FK | 数据来源 | GD_2021_331 |
| notes | TEXT | 备注 | 仅7-9月≥35℃执行 |

### 5. missing_records（缺失记录表）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| missing_id | TEXT PK | 编码 | MISS_GD_01 |
| region_id | TEXT FK | 适用区域 | GD |
| field_name | TEXT NOT NULL | 缺失字段 | 深谷价格 |
| description | TEXT NOT NULL | 缺失描述 | 广东省未设置深谷时段 |
| search_process | TEXT NOT NULL | 检索过程 | 搜索... |
| judgment_basis | TEXT NOT NULL | 判断依据 | 政策文件中未出现深谷分类 |
| status | TEXT NOT NULL | 状态 | 已确认/待验证 |
| notes | TEXT | 备注 | — |

## 编码规则

- **region_id**: 省代码(2位) 或 省_市代码(2位)，如 GD, GD_GZ
- **policy_id**: 省代码_用户类型_序号，如 GD_COMM_1
- **period_id**: 省代码_P序号，如 GD_P1
- **source_id**: 省代码_年份_关键词，如 GD_2021_331
- **missing_id**: MISS_省代码_序号，如 MISS_GD_01