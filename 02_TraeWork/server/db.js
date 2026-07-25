// ============================================================
// 城市分时电价观察站 - SQLite 数据库访问模块
// ============================================================

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'electricity_price.db');

let db = null;

function getDb() {
    if (!db) {
        try {
            db = new Database(DB_PATH);
            db.pragma('journal_mode = WAL');
            db.pragma('foreign_keys = ON');
        } catch (err) {
            console.error('数据库连接失败:', err.message);
            console.error('请先运行 python scripts/import_csv_to_sqlite.py 初始化数据库');
            throw err;
        }
    }
    return db;
}

// 获取所有省份区域
function getAllRegions() {
    const stmt = getDb().prepare('SELECT * FROM regions ORDER BY region_level, region_id');
    return stmt.all();
}

// 获取所有数据来源
function getAllSources() {
    const stmt = getDb().prepare('SELECT * FROM data_sources ORDER BY source_id');
    return stmt.all();
}

// 获取电价政策
function getPolicies(province) {
    let sql = `
        SELECT p.*, r.province 
        FROM policies p 
        JOIN regions r ON p.region_id = r.region_id AND r.region_type = 'province'
    `;
    const params = [];
    if (province) {
        sql += ' WHERE r.province = ?';
        params.push(province);
    }
    sql += ' ORDER BY p.region_id, p.user_type';
    const stmt = getDb().prepare(sql);
    return stmt.all(...params);
}

// 获取分时时段
function getPeriods(province, season) {
    let sql = `
        SELECT pe.*, r.province, po.policy_name, po.user_type, po.flat_price
        FROM periods pe
        JOIN regions r ON pe.region_id = r.region_id
        JOIN policies po ON pe.policy_id = po.policy_id
        WHERE r.region_type = 'province'
    `;
    const params = [];
    if (province) {
        sql += ' AND r.province = ?';
        params.push(province);
    }
    if (season) {
        sql += ' AND pe.season_type = ?';
        params.push(season);
    }
    sql += ' ORDER BY r.province, pe.season_type, pe.start_time';
    const stmt = getDb().prepare(sql);
    return stmt.all(...params);
}

// 获取缺失记录
function getMissingRecords(province) {
    let sql = `
        SELECT m.*, r.province 
        FROM missing_records m
        JOIN regions r ON m.region_id = r.region_id AND r.region_type = 'province'
    `;
    const params = [];
    if (province) {
        sql += ' WHERE r.province = ?';
        params.push(province);
    }
    sql += ' ORDER BY m.missing_id';
    const stmt = getDb().prepare(sql);
    return stmt.all(...params);
}

// 获取概览统计
function getOverview() {
    const db = getDb();
    const provinceCount = db.prepare("SELECT COUNT(*) as count FROM regions WHERE region_type = 'province'").get().count;
    const sourceCount = db.prepare('SELECT COUNT(*) as count FROM data_sources').get().count;
    const policyCount = db.prepare('SELECT COUNT(*) as count FROM policies').get().count;
    const periodCount = db.prepare('SELECT COUNT(*) as count FROM periods').get().count;
    const missingCount = db.prepare('SELECT COUNT(*) as count FROM missing_records').get().count;

    // 各省份时段数统计
    const provinceStats = db.prepare(`
        SELECT r.province, 
               COUNT(DISTINCT pe.period_id) as period_count,
               COUNT(DISTINCT po.policy_id) as policy_count
        FROM regions r
        LEFT JOIN policies po ON r.region_id = po.region_id
        LEFT JOIN periods pe ON r.region_id = pe.region_id
        WHERE r.region_type = 'province'
        GROUP BY r.province
        ORDER BY r.region_id
    `).all();

    // 各省份价格汇总
    const priceSummary = db.prepare(`
        SELECT r.province,
               MAX(CASE WHEN pe.std_category = '尖峰' THEN pe.price ELSE NULL END) as sharp_price,
               MAX(CASE WHEN pe.std_category = '峰' THEN pe.price ELSE NULL END) as peak_price,
               MAX(CASE WHEN pe.std_category = '平' THEN pe.price ELSE NULL END) as flat_price,
               MAX(CASE WHEN pe.std_category = '谷' THEN pe.price ELSE NULL END) as valley_price,
               MAX(CASE WHEN pe.std_category = '深谷' THEN pe.price ELSE NULL END) as deep_valley_price
        FROM regions r
        JOIN policies po ON r.region_id = po.region_id
        JOIN periods pe ON r.region_id = pe.region_id
        WHERE r.region_type = 'province' AND po.user_type = '工商业'
        GROUP BY r.province
        ORDER BY r.region_id
    `).all();

    return {
        provinceCount,
        sourceCount,
        policyCount,
        periodCount,
        missingCount,
        provinceStats,
        priceSummary
    };
}

// 获取24小时电价曲线
function getDailyCurve(province, season) {
    let sql = `
        SELECT pe.start_time, pe.end_time, pe.price, pe.std_category, 
               pe.original_name, r.province, po.policy_name, po.user_type
        FROM periods pe
        JOIN regions r ON pe.region_id = r.region_id
        JOIN policies po ON pe.policy_id = po.policy_id
        WHERE r.region_type = 'province' AND po.user_type = '工商业'
    `;
    const params = [];
    if (province) {
        sql += ' AND r.province = ?';
        params.push(province);
    }
    if (season) {
        sql += ' AND pe.season_type = ?';
        params.push(season);
    }
    // 排除居民时段
    sql += " AND po.user_type != '居民'";
    sql += ' ORDER BY r.province, pe.start_time';
    const stmt = getDb().prepare(sql);
    return stmt.all(...params);
}

module.exports = {
    getAllRegions,
    getAllSources,
    getPolicies,
    getPeriods,
    getMissingRecords,
    getOverview,
    getDailyCurve
};