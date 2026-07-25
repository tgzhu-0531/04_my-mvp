-- ============================================================
-- 城市分时电价观察站 - 数据库初始化脚本
-- 数据库: SQLite 3
-- 用途: 创建核心表结构
-- 设计说明:
--   - 行政区域表(regions): 支持省-市-区三级结构，region_id为主键
--   - 数据来源表(data_sources): 记录每一条数据的公开来源URL和发布机构
--   - 电价政策表(policies): 按省份、用户类型、电压等级、季节维度定义政策
--   - 分时时段表(periods): 每条时段记录包含适用地区、标准分类、起止时间、电价
--   - 缺失记录表(missing_records): 记录经检索仍无法确认的数据项
--   - 外键约束确保数据完整性和可追溯性
-- ============================================================

-- 行政区域表
CREATE TABLE IF NOT EXISTS regions (
    region_id TEXT PRIMARY KEY,           -- 区域编码，如 GD、GD_GZ
    province TEXT NOT NULL,                -- 省份名称
    city TEXT DEFAULT '',                  -- 城市名称
    district TEXT DEFAULT '',              -- 区县名称
    region_type TEXT NOT NULL,             -- 区域类型: province/city/district
    region_level INTEGER NOT NULL,         -- 层级: 1=省 2=市 3=区县
    province_code TEXT DEFAULT ''          -- 行政区划代码
);

-- 数据来源表
CREATE TABLE IF NOT EXISTS data_sources (
    source_id TEXT PRIMARY KEY,            -- 来源编码
    source_name TEXT NOT NULL,             -- 来源名称/标题
    source_url TEXT NOT NULL,              -- 来源URL
    issuing_authority TEXT NOT NULL,       -- 发布机构
    publish_date TEXT NOT NULL,            -- 发布时间
    collect_date TEXT NOT NULL,            -- 数据采集时间
    reliability TEXT NOT NULL DEFAULT '中', -- 可靠性: 高/中/低
    notes TEXT DEFAULT ''                  -- 备注说明
);

-- 电价政策表
CREATE TABLE IF NOT EXISTS policies (
    policy_id TEXT PRIMARY KEY,            -- 政策编码
    region_id TEXT NOT NULL,               -- 适用区域(外键)
    user_type TEXT NOT NULL,               -- 用户类型: 工商业/居民/农业
    voltage_level TEXT NOT NULL,           -- 电压等级
    season_type TEXT NOT NULL,             -- 季节类型: 全年/夏/冬/春秋
    policy_name TEXT NOT NULL,             -- 政策名称
    flat_price REAL,                       -- 平段电价(元/kWh)
    peak_ratio REAL,                       -- 峰段比价系数
    valley_ratio REAL,                     -- 谷段比价系数
    peak_price REAL,                       -- 峰段电价(元/kWh)
    valley_price REAL,                     -- 谷段电价(元/kWh)
    sharp_price REAL,                      -- 尖峰电价(元/kWh)
    deep_valley_price REAL,                -- 深谷电价(元/kWh)
    effective_date TEXT,                   -- 生效日期
    expiry_date TEXT,                      -- 失效日期(空表示仍有效)
    source_id TEXT NOT NULL,               -- 数据来源(外键)
    notes TEXT DEFAULT '',                 -- 备注
    FOREIGN KEY (region_id) REFERENCES regions(region_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id)
);

-- 分时时段表
CREATE TABLE IF NOT EXISTS periods (
    period_id TEXT PRIMARY KEY,            -- 时段编码
    policy_id TEXT NOT NULL,               -- 关联政策(外键)
    region_id TEXT NOT NULL,               -- 适用区域(外键)
    season_type TEXT NOT NULL,             -- 季节类型
    std_category TEXT NOT NULL,            -- 标准分类: 尖峰/峰/平/谷/深谷
    original_name TEXT NOT NULL,           -- 原始时段名称
    start_time TEXT NOT NULL,              -- 开始时间(HH:MM)
    end_time TEXT NOT NULL,                -- 结束时间(HH:MM)
    price REAL,                            -- 电价(元/kWh)，空表示按浮动系数计算
    source_id TEXT NOT NULL,               -- 数据来源(外键)
    notes TEXT DEFAULT '',                 -- 备注
    FOREIGN KEY (policy_id) REFERENCES policies(policy_id),
    FOREIGN KEY (region_id) REFERENCES regions(region_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id)
);

-- 缺失记录表
CREATE TABLE IF NOT EXISTS missing_records (
    missing_id TEXT PRIMARY KEY,           -- 缺失记录编码
    region_id TEXT NOT NULL,               -- 适用区域(外键)
    field_name TEXT NOT NULL,              -- 缺失字段名称
    description TEXT NOT NULL,             -- 缺失描述
    search_process TEXT NOT NULL,          -- 检索过程说明
    judgment_basis TEXT NOT NULL,          -- 判断依据
    status TEXT NOT NULL DEFAULT '待验证', -- 状态: 已确认/待验证/无法获取
    notes TEXT DEFAULT '',                 -- 备注
    FOREIGN KEY (region_id) REFERENCES regions(region_id)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_periods_region ON periods(region_id);
CREATE INDEX IF NOT EXISTS idx_periods_policy ON periods(policy_id);
CREATE INDEX IF NOT EXISTS idx_periods_category ON periods(std_category);
CREATE INDEX IF NOT EXISTS idx_policies_region ON policies(region_id);
CREATE INDEX IF NOT EXISTS idx_policies_user_type ON policies(user_type);
CREATE INDEX IF NOT EXISTS idx_missing_region ON missing_records(region_id);