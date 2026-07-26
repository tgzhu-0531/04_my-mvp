-- ===========================================
-- 城市分时电价观察站 · 数据库初始化脚本
-- 数据库引擎：SQLite 3
-- ===========================================

-- 1. 行政区域表
CREATE TABLE IF NOT EXISTS provinces (
    province_id    TEXT PRIMARY KEY,
    province_name  TEXT NOT NULL,
    province_abbr  TEXT,
    region         TEXT,
    area_km2       INTEGER,
    data_status    TEXT DEFAULT 'pending' CHECK(data_status IN ('verified','pending','missing'))
);

-- 2. 电价政策表
CREATE TABLE IF NOT EXISTS policies (
    policy_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id    TEXT NOT NULL REFERENCES provinces(province_id),
    policy_name    TEXT NOT NULL,
    publisher      TEXT,
    doc_number     TEXT,
    publish_date   TEXT,
    effective_date TEXT,
    expire_date    TEXT,
    user_type      TEXT,
    source_id      TEXT,
    created_at     TEXT DEFAULT (datetime('now','localtime'))
);

-- 3. 分时时段与价格表
CREATE TABLE IF NOT EXISTS time_periods (
    period_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id      TEXT NOT NULL REFERENCES provinces(province_id),
    user_type        TEXT,
    voltage_level    TEXT,
    season_type      TEXT,
    period_name      TEXT NOT NULL,
    standard_category TEXT NOT NULL CHECK(standard_category IN ('尖','峰','平','谷','深谷')),
    start_time       TEXT NOT NULL,
    end_time         TEXT NOT NULL,
    price_yuan_per_kwh REAL,
    ratio_to_flat    REAL,
    source_id        TEXT,
    notes            TEXT
);

-- 4. 数据来源表
CREATE TABLE IF NOT EXISTS sources (
    source_id      TEXT PRIMARY KEY,
    province_id    TEXT NOT NULL REFERENCES provinces(province_id),
    source_name    TEXT NOT NULL,
    publisher      TEXT,
    doc_number     TEXT,
    publish_date   TEXT,
    effective_date TEXT,
    source_url     TEXT,
    reliability    TEXT DEFAULT 'pending',
    collect_date   TEXT
);

-- 5. 缺失与待验证数据登记表
CREATE TABLE IF NOT EXISTS missing_data (
    missing_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id    TEXT NOT NULL REFERENCES provinces(province_id),
    missing_type   TEXT NOT NULL,
    missing_item   TEXT NOT NULL,
    reason         TEXT,
    search_process TEXT,
    search_date    TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_periods_province ON time_periods(province_id);
CREATE INDEX IF NOT EXISTS idx_periods_category ON time_periods(standard_category);
CREATE INDEX IF NOT EXISTS idx_sources_province  ON sources(province_id);
CREATE INDEX IF NOT EXISTS idx_missing_province  ON missing_data(province_id);
