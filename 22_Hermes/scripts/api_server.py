#!/usr/bin/env python3
"""
城市分时电价观察站 - SQLite 数据接口服务
用于本地验证场景，提供 RESTful API 供前端读取 SQLite 数据库

启动方式：python scripts/api_server.py
服务地址：http://localhost:8080

API 端点：
  GET /api/tou_rates       - 分时电价数据
  GET /api/data_sources    - 数据来源
  GET /api/missing_records - 缺失数据
  GET /api/province_summary- 省份汇总
"""

import json
import sqlite3
import http.server
import urllib.parse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "sqlite" / "electricity_pricing.db"

# API 查询映射
API_QUERIES = {
    "tou_rates": """
        SELECT 
            r.province, r.city, r.district,
            p.user_type, p.voltage_level, p.season_type,
            tp.period_name, tp.standard_category,
            tp.start_time, tp.end_time, tp.price, tp.is_next_day,
            tp.remarks as period_remarks,
            p.policy_name, p.effective_date, p.description as policy_desc,
            ds.source_name, ds.source_url, ds.publish_authority,
            ds.publish_date, ds.collect_date, ds.reliability,
            tp.id as time_period_id,
            p.id as policy_id,
            r.id as region_id
        FROM time_periods tp
        JOIN policies p ON tp.policy_id = p.id
        JOIN regions r ON p.region_id = r.id
        LEFT JOIN data_source_links dsl ON dsl.entity_type = 'time_period' AND dsl.entity_id = tp.id
        LEFT JOIN data_sources ds ON dsl.source_id = ds.id
        ORDER BY r.province, p.season_type, tp.start_time
    """,
    "data_sources": """
        SELECT source_name, source_url, publish_authority, publish_date, collect_date, data_type, reliability, remarks
        FROM data_sources ORDER BY publish_authority
    """,
    "missing_records": """
        SELECT province, city, user_type, missing_item, search_process, search_date, status, remarks
        FROM missing_records ORDER BY province
    """,
    "province_summary": """
        SELECT 
            r.province,
            COUNT(DISTINCT tp.id) as period_count,
            COUNT(DISTINCT p.id) as policy_count,
            MIN(tp.price) as min_price,
            MAX(tp.price) as max_price,
            ROUND(MAX(tp.price) - MIN(tp.price), 4) as peak_valley_spread,
            GROUP_CONCAT(DISTINCT p.season_type) as season_types,
            GROUP_CONCAT(DISTINCT p.user_type) as user_types
        FROM regions r
        JOIN policies p ON p.region_id = r.id
        JOIN time_periods tp ON tp.policy_id = p.id
        GROUP BY r.province
        ORDER BY r.province
    """
}


class APIHandler(http.server.BaseHTTPRequestHandler):
    
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        # CORS 头
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        
        # 处理 API 请求
        if path.startswith("/api/"):
            api_name = path[5:]  # 去掉 "/api/"
            if api_name in API_QUERIES:
                try:
                    conn = sqlite3.connect(str(DB_PATH))
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    cursor.execute(API_QUERIES[api_name])
                    rows = [dict(row) for row in cursor.fetchall()]
                    conn.close()
                    
                    # 处理日期等非序列化类型
                    result = json.dumps(rows, ensure_ascii=False, default=str)
                    self.wfile.write(result.encode("utf-8"))
                except Exception as e:
                    self.wfile.write(json.dumps({
                        "error": str(e),
                        "message": "数据库查询失败"
                    }, ensure_ascii=False).encode("utf-8"))
            else:
                self.wfile.write(json.dumps({
                    "error": "unknown_api",
                    "message": f"未知 API: {api_name}",
                    "available": list(API_QUERIES.keys())
                }, ensure_ascii=False).encode("utf-8"))
        elif path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            html = """<html><body>
            <h1>\u57ce\u5e02\u5206\u65f6\u7535\u4ef7\u89c2\u5bdf\u7ad9 - SQLite API \u670d\u52a1</h1>
            <p>\u670d\u52a1\u8fd0\u884c\u4e2d</p>
            <h2>\u53ef\u7528 API\uff1a</h2>
            <ul>
                <li><a href="/api/tou_rates">/api/tou_rates</a></li>
                <li><a href="/api/data_sources">/api/data_sources</a></li>
                <li><a href="/api/missing_records">/api/missing_records</a></li>
                <li><a href="/api/province_summary">/api/province_summary</a></li>
            </ul>
            </body></html>"""
            self.wfile.write(html.encode("utf-8"))
        else:
            self.wfile.write(json.dumps({
                "error": "not_found",
                "message": f"路径未找到: {path}"
            }, ensure_ascii=False).encode("utf-8"))
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def log_message(self, format, *args):
        print(f"[API Server] {args[0]} {args[1]} {args[2]}")


def main():
    if not DB_PATH.exists():
        print(f"错误：数据库文件不存在！")
        print(f"请先运行 python scripts/init_db.py 初始化数据库")
        print(f"数据库路径: {DB_PATH}")
        return 1
    
    host = "localhost"
    port = 8080
    server = http.server.HTTPServer((host, port), APIHandler)
    print(f"=" * 50)
    print(f"城市分时电价观察站 - SQLite 数据接口服务")
    print(f"=" * 50)
    print(f"数据库: {DB_PATH}")
    print(f"服务地址: http://{host}:{port}")
    print(f"API 端点:")
    for name in API_QUERIES:
        print(f"  http://{host}:{port}/api/{name}")
    print(f"\n按 Ctrl+C 停止服务")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.server_close()
    
    return 0


if __name__ == "__main__":
    main()
