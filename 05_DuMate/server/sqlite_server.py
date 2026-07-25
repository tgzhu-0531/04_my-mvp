#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
城市分时电价观察站 - SQLite 数据接口服务
功能: 提供 HTTP API 供前端读取 SQLite 数据
使用: python sqlite_server.py
依赖: 仅使用 Python 标准库（无需安装第三方包）
"""

import json
import os
import sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

class PriceDataHandler(BaseHTTPRequestHandler):
    
    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def _get_db_path(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        project_dir = os.path.dirname(base_dir)
        return os.path.join(project_dir, 'database', 'electricity_pricing.db')
    
    def _execute_query(self, query, params=()):
        db_path = self._get_db_path()
        if not os.path.exists(db_path):
            return None, '数据库文件不存在，请先运行 init_database.py'
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows], None
        except Exception as e:
            return None, str(e)
        finally:
            conn.close()
    
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        
        if path == '/api/provinces':
            data, err = self._execute_query('SELECT * FROM provinces ORDER BY id')
            if err:
                self._send_json({'error': err}, 500)
            else:
                self._send_json(data)
        
        elif path == '/api/sources':
            data, err = self._execute_query('SELECT * FROM sources ORDER BY id')
            if err:
                self._send_json({'error': err}, 500)
            else:
                self._send_json(data)
        
        elif path == '/api/prices':
            province_id = params.get('province_id', [None])[0]
            season = params.get('season', [None])[0]
            user_type = params.get('user_type', [None])[0]
            
            query = '''
                SELECT p.*, pr.province_name, pr.region, s.source_name, s.source_url, s.issuing_authority
                FROM price_policies p
                JOIN provinces pr ON p.province_id = pr.id
                JOIN sources s ON p.source_id = s.id
                WHERE 1=1
            '''
            query_params = []
            if province_id:
                query += ' AND p.province_id = ?'
                query_params.append(province_id)
            if season:
                query += ' AND p.season_type LIKE ?'
                query_params.append(f'%{season}%')
            if user_type:
                query += ' AND p.user_type LIKE ?'
                query_params.append(f'%{user_type}%')
            query += ' ORDER BY p.province_id, p.start_time'
            
            data, err = self._execute_query(query, tuple(query_params))
            if err:
                self._send_json({'error': err}, 500)
            else:
                self._send_json(data)
        
        elif path == '/api/missing':
            data, err = self._execute_query('''
                SELECT m.*, pr.province_name 
                FROM missing_data m 
                JOIN provinces pr ON m.province_id = pr.id 
                ORDER BY m.id
            ''')
            if err:
                self._send_json({'error': err}, 500)
            else:
                self._send_json(data)
        
        elif path == '/api/config':
            self._send_json({'dataSource': 'sqlite'})
        
        elif path == '/api/health':
            self._send_json({'status': 'ok', 'mode': 'sqlite'})
        
        else:
            self._send_json({'error': 'Not found'}, 404)
    
    def log_message(self, format, *args):
        # 简化日志输出
        print(f'[SQLite Server] {args[0]}')

def main():
    port = 3000
    server = HTTPServer(('localhost', port), PriceDataHandler)
    print(f'[SQLite Server] 服务已启动: http://localhost:{port}')
    print(f'[SQLite Server] API 端点:')
    print(f'  - GET /api/provinces  获取省份列表')
    print(f'  - GET /api/sources    获取数据来源')
    print(f'  - GET /api/prices     获取电价数据 (支持 province_id/season/user_type 筛选)')
    print(f'  - GET /api/missing    获取缺失数据')
    print(f'  - GET /api/config     获取当前配置')
    print(f'  - GET /api/health     健康检查')
    print(f'\n[SQLite Server] 按 Ctrl+C 停止服务')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[SQLite Server] 服务已停止')
        server.server_close()

if __name__ == '__main__':
    main()
