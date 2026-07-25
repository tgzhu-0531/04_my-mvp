# 数据字典

## 一、CSV 数据文件结构

### 1. 分时电价数据文件（data/{province}.csv）

每个省份一个文件，字段说明如下：

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| province | string | 是 | 省份名称 | 广东 |
| city | string | 是 | 适用城市/区域 | 珠三角五市 |
| region | string | 否 | 具体行政区划 | 广州/珠海/佛山/中山/东莞 |
| user_type | string | 是 | 用户类型 | 一般工商业 / 大工业 |
| voltage_level | string | 是 | 电压等级 | 不满1千伏 / 1-10千伏 |
| season | string | 是 | 适用季节 | 全年 / 夏季(6-8月) / 冬季(12-2月) / 3-5月 |
| period_name | string | 是 | 原始时段名称 | 高峰 / 平段 / 低谷 / 尖峰 / 深谷 |
| standard_category | string | 是 | 标准分类 | 尖峰 / 高峰 / 平段 / 低谷 / 深谷 |
| start_time | string | 是 | 时段起始时间(HH:MM) | 10:00 |
| end_time | string | 是 | 时段终止时间(HH:MM) | 12:00 |
| price | number | 是 | 电价(元/kWh) | 1.2919 |
| unit | string | 否 | 价格单位(默认元/kWh) | 元/kWh |
| effective_date | string | 是 | 政策生效日期 | 2026-01-01 |
| source_id | string | 是 | 来源ID(关联sources.csv) | GD-001 |
| remark | string | 否 | 备注说明 | 高温日尖峰在高峰基础上上浮25% |

### 2. 数据来源文件（data/sources.csv）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 来源唯一标识 |
| province | string | 所属省份 |
| url | string | 来源URL |
| publishing_org | string | 发布机构 |
| publish_time | string | 发布时间 |
| collection_time | string | 采集时间 |
| reliability | string | 可信度(高/中/低) |
| remark | string | 备注 |

### 3. 缺失数据记录文件（data/missing_data.csv）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 缺失记录ID |
| province | string | 所属省份 |
| field | string | 缺失字段名 |
| description | string | 缺失说明 |
| reason | string | 缺失原因 |
| source_id | string | 关联来源ID |

## 二、标准分类说明

| 标准分类 | 代码 | 说明 |
|----------|------|------|
| 尖峰 | peak | 用电最高峰时段，电价最高 |
| 高峰 | high | 用电高峰时段，电价较高 |
| 平段 | flat | 用电平均时段，基准电价 |
| 低谷 | valley | 用电低谷时段，电价较低 |
| 深谷 | deep_valley | 用电最低谷时段，电价最低 |

## 三、价格单位

所有电价统一使用 **元/kWh**。若原始来源使用不同单位（如分/千瓦时），在数据录入时已换算为元/kWh，并在remark中注明换算方式。

## 四、用户类型

| 类型 | 说明 |
|------|------|
| 一般工商业 | 商业、中小型工业企业 |
| 大工业 | 大型工业企业(通常变压器容量≥315kVA) |
| 居民 | 居民生活用电(本项目暂不覆盖) |

## 五、数据状态

| 状态 | 说明 |
|------|------|
| active | 已收录、已确认 |
| pending | 待补充/待验证 |
| missing | 公开渠道无法获取 |
