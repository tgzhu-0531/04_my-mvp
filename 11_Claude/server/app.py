#!/usr/bin/env python3
"""
城市分时电价观察站 - SQLite 数据接口服务
运行方式: python3 server/app.py
访问地址: http://localhost:3456

提供 RESTful API 供前端在 SQLite 模式下查询数据。
"""

import json
import os
import sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# 数据库路径（相对于项目根目录）
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sqlite", "electricity_pricing.db")
PORT = 3456

# CORS 头
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
}


def get_db():
    """获取数据库连接"""
    if not os.path.exists(DB_PATH):
        return None
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def query_all(table, order_by="id"):
    """查询表所有数据"""
    conn = get_db()
    if not conn:
        return {"error": "数据库未初始化，请先运行 python3 init_db.py"}
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table} ORDER BY {order_by}")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def query_by_id(table, record_id):
    """按 ID 查询"""
    conn = get_db()
    if not conn:
        return {"error": "数据库未初始化"}
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table} WHERE id=?", (record_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {"error": "未找到"}


class APIHandler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS_HEADERS.items():
            if k != "Content-Type":
                self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        response_data = None

        try:
            if path == "/api/regions":
                response_data = query_all("regions")

            elif path == "/api/sources":
                response_data = query_all("sources")

            elif path == "/api/policies":
                response_data = query_all("policies")

            elif path == "/api/time-periods":
                response_data = query_all("time_periods")

            elif path == "/api/price-points":
                response_data = query_all("price_points")

            elif path == "/api/missing-data":
                response_data = query_all("missing_data")

            elif path == "/api/overview":
                # 综合概览数据
                conn = get_db()
                if conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT COUNT(DISTINCT province_id) FROM regions")
                    province_count = cursor.fetchone()[0]
                    cursor.execute("SELECT COUNT(*) FROM sources")
                    source_count = cursor.fetchone()[0]
                    cursor.execute("SELECT COUNT(*) FROM policies")
                    policy_count = cursor.fetchone()[0]
                    cursor.execute("SELECT COUNT(*) FROM time_periods")
                    period_count = cursor.fetchone()[0]
                    conn.close()
                    response_data = {
                        "provinceCount": province_count,
                        "sourceCount": source_count,
                        "policyCount": policy_count,
                        "periodCount": period_count,
                        "lastUpdated": "2026-07-26"
                    }
                else:
                    response_data = {"error": "数据库未初始化"}

            elif path == "/":
                response_data = {"message": "城市分时电价观察站 API 服务运行中", "version": "1.0.0"}

            elif path.startswith("/api/policies/"):
                record_id = int(path.split("/")[-1])
                response_data = query_by_id("policies", record_id)

            elif path.startswith("/api/sources/"):
                record_id = int(path.split("/")[-1])
                response_data = query_by_id("sources", record_id)

            elif path.startswith("/api/regions/"):
                record_id = int(path.split("/")[-1])
                response_data = query_by_id("regions", record_id)

            elif path.startswith("/api/time-periods/policy/"):
                policy_id = int(path.split("/")[-1])
                conn = get_db()
                if conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM time_periods WHERE policy_id=? ORDER BY id", (policy_id,))
                    response_data = [dict(row) for row in cursor.fetchall()]
                    conn.close()
                else:
                    response_data = {"error": "数据库未初始化"}

            elif path == "/api/price-points/by-region":
                region_id = int(params.get("region_id", [0])[0])
                user_type = params.get("user_type", ["大工业用电"])[0]
                season = params.get("season", ["夏季"])[0]
                conn = get_db()
                if conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        """SELECT hour, standard_category, price_value, data_status
                           FROM price_points
                           WHERE region_id=? AND user_type=? AND season_type=?
                           ORDER BY hour""",
                        (region_id, user_type, season)
                    )
                    response_data = [dict(row) for row in cursor.fetchall()]
                    conn.close()
                else:
                    response_data = {"error": "数据库未初始化"}

            else:
                response_data = {"error": "未知路径", "path": path}

        except Exception as e:
            response_data = {"error": str(e)}

        body = json.dumps(response_data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[API] {args[0]} {args[1]} {args[2]}")


def main():
    server = HTTPServer(("0.0.0.0", PORT), APIHandler)
    print(f"\n{'='*50}")
    print(f"城市分时电价观察站 - 数据接口服务")
    print(f"{'='*50}")
    print(f"服务地址: http://localhost:{PORT}")
    print(f"接口列表:")
    print(f"  GET /api/overview        - 综合概览数据")
    print(f"  GET /api/regions         - 行政区域列表")
    print(f"  GET /api/sources         - 数据来源列表")
    print(f"  GET /api/policies        - 电价政策列表")
    print(f"  GET /api/time-periods    - 分时时段列表")
    print(f"  GET /api/price-points    - 价格曲线数据")
    print(f"  GET /api/missing-data    - 缺失数据记录")
    print(f"  GET /api/price-points/by-region?region_id=1&user_type=大工业用电&season=夏季")
    print(f"\n按 Ctrl+C 停止服务")
    print(f"{'='*50}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.server_close()


if __name__ == "__main__":
    main()
