"""
数据库连接与初始化
城市分时电价观察站 - MVP
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "electricity_prices.db")

def get_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_database():
    """初始化数据库结构"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 城市表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            province TEXT NOT NULL,
            region TEXT NOT NULL DEFAULT '其他',
            grid_company TEXT NOT NULL DEFAULT '国家电网',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 分时时段定义表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS price_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL,
            period_name TEXT NOT NULL CHECK(period_name IN ('尖峰', '高峰', '平段', '低谷')),
            season TEXT NOT NULL CHECK(season IN ('夏季', '非夏季', '全年')),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            FOREIGN KEY (city_id) REFERENCES cities(id)
        )
    ''')
    
    # 电价记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS price_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL,
            period_name TEXT NOT NULL CHECK(period_name IN ('尖峰', '高峰', '平段', '低谷')),
            voltage_level TEXT NOT NULL DEFAULT '1-10kV',
            price_per_kwh REAL NOT NULL,
            effective_date DATE NOT NULL,
            source_id INTEGER,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (city_id) REFERENCES cities(id),
            FOREIGN KEY (source_id) REFERENCES data_sources(id)
        )
    ''')
    
    # 年度价格趋势表（同一城市不同年份对比）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS annual_price_trends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL,
            year INTEGER NOT NULL,
            peak_price REAL,
            flat_price REAL,
            valley_price REAL,
            spike_price REAL,
            source_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (city_id) REFERENCES cities(id),
            FOREIGN KEY (source_id) REFERENCES data_sources(id)
        )
    ''')
    
    # 数据来源表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS data_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_name TEXT NOT NULL UNIQUE,
            source_type TEXT NOT NULL CHECK(source_type IN ('政府官网', '电网公司', '媒体', '学术', '其他')),
            url TEXT,
            description TEXT,
            retrieval_date DATE,
            reliability_score INTEGER CHECK(reliability_score >= 1 AND reliability_score <= 5),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"[OK] 数据库初始化完成: {DB_PATH}")

if __name__ == "__main__":
    init_database()
