#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
城市分时电价观察站 MVP - SQLite API 服务
作为前端查询 SQLite 数据库的后端接口

用法: python api.py [--port 8080] [--db ../database/electricity_prices.db]
"""

import http.server
import json
import sqlite3
import os
import urllib.parse
import argparse
from pathlib import Path


class PriceAPIHandler(http.server.BaseHTTPRequestHandler):
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)
        
        # Route handling
        if path == '/api/provinces' or path == '/api/provinces/':
            self.handle_get_provinces()
        elif path == '/api/tariff-types' or path == '/api/tariff-types/':
            self.handle_get_tariff_types(params)
        elif path == '/api/prices' or path == '/api/prices/':
            self.handle_get_prices(params)
        elif path == '/api/data-sources' or path == '/api/data-sources/':
            self.handle_get_data_sources(params)
        elif path == '/api/config':
            self.handle_get_config()
        elif path == '/api/summary':
            self.handle_get_summary()
        elif path == '/api/health':
            self.handle_health()
        else:
            self.send_json(404, {'error': 'Not found', 'path': path})
    
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def get_db(self):
        db_path = getattr(self.server, 'db_path', None)
        if not db_path:
            db_path = os.path.join(os.path.dirname(__file__), '../database/electricity_prices.db')
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        return conn
    
    def handle_health(self):
        self.send_json(200, {'status': 'ok', 'service': 'Price Observatory API'})
    
    def handle_get_provinces(self):
        conn = self.get_db()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM provinces ORDER BY province_id")
            rows = [dict(row) for row in cursor.fetchall()]
            self.send_json(200, {'provinces': rows, 'count': len(rows)})
        finally:
            conn.close()
    
    def handle_get_tariff_types(self, params):
        conn = self.get_db()
        try:
            query = "SELECT * FROM tariff_types"
            conditions = []
            values = []
            
            if 'province_id' in params:
                conditions.append("province_id = ?")
                values.append(params['province_id'][0])
            if 'user_category' in params:
                conditions.append("user_category = ?")
                values.append(params['user_category'][0])
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY province_id, type_id"
            
            cursor = conn.cursor()
            cursor.execute(query, values)
            rows = [dict(row) for row in cursor.fetchall()]
            self.send_json(200, {'tariff_types': rows, 'count': len(rows)})
        finally:
            conn.close()
    
    def handle_get_prices(self, params):
        conn = self.get_db()
        try:
            query = """
                SELECT p.*, t.type_name, t.user_category, t.voltage_level,
                       s.source_name, s.source_url, s.reliability
                FROM prices p
                LEFT JOIN tariff_types t ON p.type_id = t.type_id
                LEFT JOIN data_sources s ON p.source_id = s.source_id
            """
            conditions = []
            values = []
            
            if 'province_id' in params:
                conditions.append("p.province_id = ?")
                values.append(params['province_id'][0])
            if 'type_id' in params:
                conditions.append("p.type_id = ?")
                values.append(params['type_id'][0])
            if 'season' in params:
                conditions.append("p.season = ?")
                values.append(params['season'][0])
            if 'standard_category' in params:
                conditions.append("p.standard_category = ?")
                values.append(params['standard_category'][0])
            if 'user_category' in params:
                conditions.append("t.user_category = ?")
                values.append(params['user_category'][0])
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY p.province_id, p.standard_category, p.start_time"
            
            cursor = conn.cursor()
            cursor.execute(query, values)
            rows = [dict(row) for row in cursor.fetchall()]
            self.send_json(200, {'prices': rows, 'count': len(rows)})
        finally:
            conn.close()
    
    def handle_get_data_sources(self, params):
        conn = self.get_db()
        try:
            query = "SELECT * FROM data_sources"
            conditions = []
            values = []
            
            if 'province_id' in params:
                conditions.append("province_id = ?")
                values.append(params['province_id'][0])
            if 'source_type' in params:
                conditions.append("source_type = ?")
                values.append(params['source_type'][0])
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY province_id, source_id"
            
            cursor = conn.cursor()
            cursor.execute(query, values)
            rows = [dict(row) for row in cursor.fetchall()]
            self.send_json(200, {'data_sources': rows, 'count': len(rows)})
        finally:
            conn.close()
    
    def handle_get_config(self):
        config_path = os.path.join(os.path.dirname(__file__), '../config.json')
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            self.send_json(200, config)
        except FileNotFoundError:
            self.send_json(404, {'error': 'config.json not found'})
    
    def handle_get_summary(self):
        conn = self.get_db()
        try:
            cursor = conn.cursor()
            
            # Province count
            cursor.execute("SELECT COUNT(*) as c FROM provinces")
            province_count = cursor.fetchone()['c']
            
            # Price records count
            cursor.execute("SELECT COUNT(*) as c FROM prices")
            price_count = cursor.fetchone()['c']
            
            # Data sources count
            cursor.execute("SELECT COUNT(*) as c FROM data_sources")
            source_count = cursor.fetchone()['c']
            
            # Price records per province
            cursor.execute("""
                SELECT p.province_id, pr.province_name, COUNT(*) as count
                FROM prices p
                JOIN provinces pr ON p.province_id = pr.province_id
                GROUP BY p.province_id
                ORDER BY p.province_id
            """)
            per_province = [dict(row) for row in cursor.fetchall()]
            
            # Categories distribution
            cursor.execute("""
                SELECT standard_category, COUNT(*) as count
                FROM prices
                GROUP BY standard_category
                ORDER BY count DESC
            """)
            categories = [dict(row) for row in cursor.fetchall()]
            
            summary = {
                'totalProvinces': province_count,
                'totalPriceRecords': price_count,
                'totalDataSources': source_count,
                'perProvince': per_province,
                'categoryDistribution': categories,
                'lastUpdated': '2025-07-01'
            }
            self.send_json(200, summary)
        finally:
            conn.close()


def run_server(port, db_path):
    server = http.server.HTTPServer(('0.0.0.0', port), PriceAPIHandler)
    server.db_path = db_path
    print(f"Price Observatory API Server running on http://0.0.0.0:{port}")
    print(f"Database: {db_path}")
    print(f"Endpoints:")
    print(f"  GET /api/health")
    print(f"  GET /api/config")
    print(f"  GET /api/summary")
    print(f"  GET /api/provinces")
    print(f"  GET /api/tariff-types?province_id=gd")
    print(f"  GET /api/prices?province_id=gd&season=summer")
    print(f"  GET /api/data-sources?province_id=gd")
    print("\nPress Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Price Observatory API Server')
    parser.add_argument('--port', type=int, default=8080, help='Server port (default: 8080)')
    parser.add_argument('--db', default='../database/electricity_prices.db', help='SQLite database path')
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.is_absolute():
        db_path = Path(__file__).parent / args.db
    db_path = db_path.resolve()
    
    run_server(args.port, str(db_path))
