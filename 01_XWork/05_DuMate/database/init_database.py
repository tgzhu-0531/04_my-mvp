#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
城市分时电价观察站 - SQLite 数据库初始化脚本
功能: 读取 init_db.sql 创建数据库结构并导入全部数据
使用: python init_database.py
"""

import os
import sqlite3
import sys

def init_database():
    # 路径设置
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(base_dir)
    sql_file = os.path.join(base_dir, 'init_db.sql')
    db_path = os.path.join(base_dir, 'electricity_pricing.db')
    
    # 读取 SQL 脚本
    if not os.path.exists(sql_file):
        print(f'[ERROR] SQL 文件不存在: {sql_file}')
        sys.exit(1)
    
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_script = f.read()
    
    # 删除旧数据库（如存在）
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f'[INFO] 已删除旧数据库: {db_path}')
    
    # 创建并初始化数据库
    conn = sqlite3.connect(db_path)
    conn.executescript(sql_script)
    conn.commit()
    
    # 验证数据
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM provinces')
    province_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM sources')
    source_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM price_policies')
    policy_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM missing_data')
    missing_count = cursor.fetchone()[0]
    
    conn.close()
    
    print(f'[SUCCESS] 数据库初始化完成: {db_path}')
    print(f'  - 行政区域: {province_count} 条')
    print(f'  - 数据来源: {source_count} 条')
    print(f'  - 电价政策: {policy_count} 条')
    print(f'  - 缺失记录: {missing_count} 条')

if __name__ == '__main__':
    init_database()
