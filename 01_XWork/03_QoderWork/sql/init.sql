-- ============================================================
-- 城市分时电价观察站 - SQLite 数据库初始化脚本
-- 适用: SQLite 3.x
-- 创建人: QoderWork AI Agent
-- 创建日期: 2026-07-25
-- ============================================================

-- 省份表
CREATE TABLE IF NOT EXISTS provinces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT,                      -- 行政区划代码
    region TEXT,                    -- 所属大区
    status TEXT DEFAULT 'active',   -- active: 已收录, pending: 待补充
    remark TEXT
);

-- 城市/地区表
CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL REFERENCES provinces(id),
    name TEXT NOT NULL,
    region TEXT,                    -- 具体区域描述
    voltage_level TEXT,             -- 电压等级描述
    user_type TEXT,                 -- 用户类型: 一般工商业/大工业/居民
    status TEXT DEFAULT 'active'
);

-- 电价政策表
CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL REFERENCES provinces(id),
    policy_name TEXT NOT NULL,
    document_number TEXT,           -- 文号
    issuing_org TEXT,               -- 发布机构
    publish_date DATE,
    effective_date DATE,
    expiry_date DATE,
    url TEXT,                       -- 政策原文URL
    remark TEXT
);

-- 分时时段表
CREATE TABLE IF NOT EXISTS time_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL REFERENCES provinces(id),
    city_id INTEGER REFERENCES cities(id),
    user_type TEXT,                 -- 一般工商业/大工业/居民
    voltage_level TEXT,
    season TEXT,                    -- 全年/夏季/冬季/春秋季/特定月份
    period_name TEXT,               -- 原始名称: 尖峰/高峰/平段/低谷/深谷
    standard_category TEXT,         -- 标准分类: 尖峰/高峰/平段/低谷/深谷
    start_time TEXT NOT NULL,       -- HH:MM 格式
    end_time TEXT NOT NULL,         -- HH:MM 格式
    price REAL,                     -- 元/kWh
    unit TEXT DEFAULT '元/kWh',
    policy_id INTEGER REFERENCES policies(id),
    source_id INTEGER REFERENCES sources(id),
    effective_date DATE,
    expiry_date DATE,
    remark TEXT
);

-- 数据来源表
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL REFERENCES provinces(id),
    url TEXT NOT NULL,
    publishing_org TEXT,
    publish_time DATE,
    collection_time DATE,
    reliability TEXT,               -- 高/中/低
    remark TEXT
);

-- 缺失数据记录表
CREATE TABLE IF NOT EXISTS missing_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL REFERENCES provinces(id),
    field_name TEXT NOT NULL,        -- 缺失的字段
    description TEXT,                -- 缺失说明
    reason TEXT,                     -- 缺失原因
    source_id INTEGER REFERENCES sources(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 初始数据导入 (5 省)
-- ============================================================

INSERT OR IGNORE INTO provinces (id, name, code, region, status) VALUES
    (1, '广东', '440000', '华南', 'active'),
    (2, '江苏', '320000', '华东', 'active'),
    (3, '山东', '370000', '华东', 'active'),
    (4, '浙江', '330000', '华东', 'active'),
    (5, '内蒙古', '150000', '华北', 'active');

-- 注意: 完整数据导入请运行配套的 import_csv.py 脚本
-- 该脚本将读取 data/ 目录下的 CSV 文件并导入到本数据库
-- 用法: python import_csv.py

-- 索引
CREATE INDEX IF NOT EXISTS idx_time_periods_province ON time_periods(province_id);
CREATE INDEX IF NOT EXISTS idx_time_periods_category ON time_periods(standard_category);
CREATE INDEX IF NOT EXISTS idx_sources_province ON sources(province_id);
CREATE INDEX IF NOT EXISTS idx_missing_data_province ON missing_data(province_id);

-- 验证查询
-- SELECT p.name AS province, COUNT(tp.id) AS period_count
-- FROM provinces p
-- LEFT JOIN time_periods tp ON tp.province_id = p.id
-- GROUP BY p.name
-- ORDER BY p.id;
