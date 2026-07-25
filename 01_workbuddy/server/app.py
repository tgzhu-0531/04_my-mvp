"""
SQLite 后端 API 服务
用于本地 sqlite 模式验证，提供 RESTful 数据接口
静态页面通过 config.json 中的 api_base_url 连接到本服务
"""
import sys
sys.path.insert(0, '..')
from flask import Flask, jsonify, request
import sqlite3
from pathlib import Path

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent  # 项目根目录
DB_PATH = BASE_DIR / 'data' / 'electricity_pricing.db'


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def query(sql, params=None):
    conn = get_db()
    try:
        if params:
            rows = conn.execute(sql, params).fetchall()
        else:
            rows = conn.execute(sql).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.route('/api/provinces')
def api_provinces():
    return jsonify(query("SELECT id, name, code, level FROM regions WHERE level=1 ORDER BY id"))


@app.route('/api/provinces/<int:rid>')
def api_province(rid):
    rows = query("SELECT * FROM regions WHERE id=?", [rid])
    return jsonify(rows[0] if rows else {})


@app.route('/api/policies')
def api_policies():
    region_id = request.args.get('region_id')
    sql = """
        SELECT p.*, ds.source_name, ds.source_url, ds.publish_authority
        FROM policies p
        LEFT JOIN data_sources ds ON ds.id = p.source_id
    """
    params = []
    if region_id:
        sql += " WHERE p.region_id = ?"
        params.append(region_id)
    sql += " ORDER BY p.id"
    return jsonify(query(sql, params if params else None))


@app.route('/api/periods')
def api_periods():
    region_id = request.args.get('region_id')
    sql = """
        SELECT tp.*, r.name as region_name
        FROM time_periods tp
        JOIN regions r ON r.id = tp.region_id
    """
    params = []
    if region_id:
        sql += " WHERE tp.region_id = ?"
        params.append(region_id)
    sql += " ORDER BY tp.season_type, tp.start_time"
    return jsonify(query(sql, params if params else None))


@app.route('/api/sources')
def api_sources():
    return jsonify(query("SELECT * FROM data_sources ORDER BY id"))


@app.route('/api/missing')
def api_missing():
    return jsonify(query("SELECT * FROM missing_records ORDER BY id"))


@app.route('/api/stats')
def api_stats():
    provinces = query("SELECT COUNT(*) as c FROM regions WHERE level=1")[0]['c']
    policies = query("SELECT COUNT(*) as c FROM policies")[0]['c']
    periods = query("SELECT COUNT(*) as c FROM time_periods")[0]['c']
    sources = query("SELECT COUNT(*) as c FROM data_sources")[0]['c']
    return jsonify({
        'province_count': provinces,
        'policy_count': policies,
        'period_count': periods,
        'source_count': sources,
    })


if __name__ == '__main__':
    import os
    port = int(os.environ.get('API_PORT', 5000))
    print(f"[INFO] SQLite API 服务启动: http://localhost:{port}")
    print(f"[INFO] 数据库路径: {DB_PATH}")
    print(f"[INFO] 静态页面中使用 csv 或 sqlite 模式可在 config.json 中切换")
    app.run(debug=False, host='0.0.0.0', port=port)
