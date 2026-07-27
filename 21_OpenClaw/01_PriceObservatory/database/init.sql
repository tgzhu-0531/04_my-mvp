-- ============================================
-- 城市分时电价观察站 MVP - SQLite 数据库初始化脚本
-- 版本: 1.0.0
-- 说明: 运行此脚本创建完整的数据库结构
-- ============================================

-- 省份表
CREATE TABLE IF NOT EXISTS provinces (
    province_id TEXT PRIMARY KEY,
    province_name TEXT NOT NULL,
    province_abbr TEXT NOT NULL,
    region TEXT NOT NULL,
    data_status TEXT DEFAULT 'verified',
    notes TEXT
);

-- 电价类型表
CREATE TABLE IF NOT EXISTS tariff_types (
    type_id TEXT PRIMARY KEY,
    type_name TEXT NOT NULL,
    province_id TEXT NOT NULL,
    voltage_level TEXT NOT NULL,
    user_category TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (province_id) REFERENCES provinces(province_id)
);

-- 电价数据表
CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id TEXT NOT NULL,
    type_id TEXT NOT NULL,
    season TEXT NOT NULL,
    original_period_name TEXT NOT NULL,
    standard_category TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    price_yuan_per_kwh REAL NOT NULL,
    effective_date TEXT NOT NULL,
    expiry_date TEXT,
    source_id TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (province_id) REFERENCES provinces(province_id),
    FOREIGN KEY (type_id) REFERENCES tariff_types(type_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id)
);

-- 数据源表
CREATE TABLE IF NOT EXISTS data_sources (
    source_id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT NOT NULL,
    publish_date TEXT,
    collect_date TEXT,
    reliability TEXT DEFAULT 'medium',
    province_id TEXT,
    notes TEXT,
    FOREIGN KEY (province_id) REFERENCES provinces(province_id)
);

-- 数据缺失记录表
CREATE TABLE IF NOT EXISTS missing_data_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id TEXT NOT NULL,
    category TEXT NOT NULL,
    field_name TEXT NOT NULL,
    reason TEXT,
    impact TEXT,
    recorded_date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (province_id) REFERENCES provinces(province_id)
);

-- 存储最近的数据采集时间戳
CREATE TABLE IF NOT EXISTS collection_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_prices_province ON prices(province_id);
CREATE INDEX IF NOT EXISTS idx_prices_type ON prices(type_id);
CREATE INDEX IF NOT EXISTS idx_prices_season ON prices(season);
CREATE INDEX IF NOT EXISTS idx_prices_standard_category ON prices(standard_category);
CREATE INDEX IF NOT EXISTS idx_prices_effective ON prices(effective_date);
CREATE INDEX IF NOT EXISTS idx_sources_province ON data_sources(province_id);
CREATE INDEX IF NOT EXISTS idx_tariff_province ON tariff_types(province_id);
