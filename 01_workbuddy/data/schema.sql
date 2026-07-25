-- ============================================================
-- 城市分时电价观察站 - SQLite 数据库初始化脚本
-- ============================================================
-- 设计说明：
-- 1. regions 表：行政区域，支持省/市/区三级 (self-referencing parent_id)
-- 2. policies 表：电价政策，记录各省份的电价政策文件
-- 3. time_periods 表：分时时段，每条时段记录包含原始名称和标准分类
-- 4. data_sources 表：数据来源，记录每条数据的来源追溯信息
-- 5. missing_records 表：缺失数据记录，标记无法找到来源的数据
-- ============================================================

-- 行政区域表
CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(20) UNIQUE,            -- 行政区划代码
    name VARCHAR(100) NOT NULL,          -- 名称（省/市/区）
    level TINYINT NOT NULL,              -- 层级：1=省, 2=市, 3=区县
    parent_id INTEGER,                   -- 上级区域ID，省级为NULL
    province_code VARCHAR(20),           -- 所属省份代码（冗余字段，便于查询）
    FOREIGN KEY (parent_id) REFERENCES regions(id)
);

-- 电价政策表
CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region_id INTEGER NOT NULL,          -- 适用地区（关联regions）
    title VARCHAR(255) NOT NULL,         -- 政策标题
    policy_doc_number VARCHAR(100),      -- 政策文号
    user_type VARCHAR(50) NOT NULL DEFAULT '工商业',  -- 用户类型：工商业/大工业/一般工商业/居民/农业
    voltage_level VARCHAR(50),           -- 电压等级
    season_type VARCHAR(50),             -- 季节类型：全年/夏冬季/春秋季/大风季/小风季等
    flat_price DECIMAL(10,5),            -- 平段电价（元/kWh），作为计算基准
    price_unit VARCHAR(20) DEFAULT '元/kWh',  -- 电价单位
    effective_date DATE,                 -- 政策生效日期
    expiry_date DATE,                    -- 政策失效日期（NULL表示目前仍有效）
    source_id INTEGER,                   -- 数据来源ID
    notes TEXT,                          -- 备注/口径说明
    data_type VARCHAR(20) DEFAULT 'real', -- 数据类型：real=真实数据, sample=示例数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES regions(id),
    FOREIGN KEY (source_id) REFERENCES data_sources(id)
);

-- 分时时段表
CREATE TABLE IF NOT EXISTS time_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id INTEGER NOT NULL,          -- 关联电价政策
    region_id INTEGER NOT NULL,          -- 适用地区
    season_type VARCHAR(50),             -- 季节类型
    original_name VARCHAR(50),           -- 原始时段名称（如"高峰"）
    standard_category VARCHAR(20) NOT NULL,  -- 标准分类：尖峰/高峰/平段/低谷/深谷
    start_time TIME NOT NULL,            -- 时段开始时间
    end_time TIME NOT NULL,              -- 时段结束时间
    price DECIMAL(10,5),                 -- 该时段的电价（元/kWh），NULL表示按浮动比例计算
    float_ratio DECIMAL(5,2),            -- 相对于平段电价的浮动比例
    user_type VARCHAR(50),               -- 适用用户类型
    voltage_level VARCHAR(50),           -- 适用电压等级
    data_type VARCHAR(20) DEFAULT 'real', -- 数据类型
    FOREIGN KEY (policy_id) REFERENCES policies(id),
    FOREIGN KEY (region_id) REFERENCES regions(id)
);

-- 数据来源表
CREATE TABLE IF NOT EXISTS data_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name VARCHAR(255) NOT NULL,    -- 来源名称
    source_url VARCHAR(500),              -- 来源URL
    publish_authority VARCHAR(255),       -- 发布机构
    publish_date DATE,                    -- 发布时间
    collect_date DATE,                    -- 数据采集时间
    reliability VARCHAR(50) DEFAULT 'high',  -- 可靠性：high/medium/low/unverified
    doc_type VARCHAR(50),                 -- 文档类型：PDF/网页/公告等
    notes TEXT,                           -- 备注
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 缺失数据记录表
CREATE TABLE IF NOT EXISTS missing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province VARCHAR(100) NOT NULL,       -- 省份
    city VARCHAR(100),                    -- 城市
    user_type VARCHAR(50),                -- 用户类型
    data_field VARCHAR(100) NOT NULL,     -- 缺失的数据字段
    search_process TEXT,                   -- 检索过程说明
    search_keywords TEXT,                  -- 检索关键词
    searched_urls TEXT,                    -- 已检索的URL列表
    judgment_basis TEXT,                   -- 无法找到的判断依据
    status VARCHAR(20) DEFAULT 'missing', -- 状态：missing/unverified/pending
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_regions_level ON regions(level);
CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_id);
CREATE INDEX IF NOT EXISTS idx_policies_region ON policies(region_id);
CREATE INDEX IF NOT EXISTS idx_policies_source ON policies(source_id);
CREATE INDEX IF NOT EXISTS idx_time_periods_policy ON time_periods(policy_id);
CREATE INDEX IF NOT EXISTS idx_time_periods_region ON time_periods(region_id);
CREATE INDEX IF NOT EXISTS idx_missing_province ON missing_records(province);
