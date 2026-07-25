#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
城市分时电价观察站 - CSV 导出脚本
功能: 从 SQLite 数据库导出 CSV 文件，用于静态展示场景
使用: python export_csv.py
"""

import csv
import os
import sqlite3

def export_csv():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(base_dir)
    db_path = os.path.join(base_dir, 'electricity_pricing.db')
    csv_dir = os.path.join(project_dir, 'data')
    
    if not os.path.exists(db_path):
        print('[ERROR] 数据库文件不存在，请先运行 init_database.py')
        return
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 导出 provinces
    cursor.execute('SELECT * FROM provinces ORDER BY id')
    rows = cursor.fetchall()
    csv_path = os.path.join(csv_dir, 'provinces.csv')
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'province_code', 'province_name', 'region', 'grid_company', 'region_note'])
        for row in rows:
            writer.writerow([row['id'], row['province_code'], row['province_name'], row['region'], row['grid_company'], row['region_note']])
    print(f'[OK] provinces.csv: {len(rows)} 条')
    
    # 导出 sources
    cursor.execute('SELECT * FROM sources ORDER BY id')
    rows = cursor.fetchall()
    csv_path = os.path.join(csv_dir, 'sources.csv')
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'source_name', 'source_url', 'issuing_authority', 'publish_date', 'collect_date', 'reliability', 'notes'])
        for row in rows:
            writer.writerow([row['id'], row['source_name'], row['source_url'], row['issuing_authority'], row['publish_date'], row['collect_date'], row['reliability'], row['notes']])
    print(f'[OK] sources.csv: {len(rows)} 条')
    
    # 导出 price_policies
    cursor.execute('SELECT * FROM price_policies ORDER BY id')
    rows = cursor.fetchall()
    csv_path = os.path.join(csv_dir, 'price_policies.csv')
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'province_id', 'season_type', 'user_type', 'voltage_level', 'original_period_name', 'standard_category', 'start_time', 'end_time', 'price_yuan_kwh', 'price_basis', 'source_id', 'policy_effective_date', 'policy_expire_date', 'data_status', 'caliber_note'])
        for row in rows:
            writer.writerow([
                row['id'], row['province_id'], row['season_type'], row['user_type'],
                row['voltage_level'], row['original_period_name'], row['standard_category'],
                row['start_time'], row['end_time'],
                row['price_yuan_kwh'] if row['price_yuan_kwh'] is not None else '',
                row['price_basis'], row['source_id'],
                row['policy_effective_date'],
                row['policy_expire_date'] if row['policy_expire_date'] is not None else '',
                row['data_status'], row['caliber_note']
            ])
    print(f'[OK] price_policies.csv: {len(rows)} 条')
    
    # 导出 missing_data
    cursor.execute('SELECT * FROM missing_data ORDER BY id')
    rows = cursor.fetchall()
    csv_path = os.path.join(csv_dir, 'missing_data.csv')
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'province_id', 'missing_field', 'reason', 'search_effort', 'next_step'])
        for row in rows:
            writer.writerow([row['id'], row['province_id'], row['missing_field'], row['reason'], row['search_effort'], row['next_step']])
    print(f'[OK] missing_data.csv: {len(rows)} 条')
    
    conn.close()
    print(f'\n[SUCCESS] CSV 文件已导出到: {csv_dir}')

if __name__ == '__main__':
    export_csv()
