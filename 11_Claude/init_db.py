#!/usr/bin/env python3
"""
城市分时电价观察站 - SQLite 数据库初始化脚本
使用方式: python3 init_db.py
执行后会在 data/sqlite/electricity_pricing.db 生成完整数据库结构并导入样本数据
"""

import sqlite3
import csv
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "sqlite", "electricity_pricing.db")
CSV_DIR = os.path.join(os.path.dirname(__file__), "data", "csv")


def create_tables(conn):
    cursor = conn.cursor()

    # 行政区域表 —— 包含省、市两级（区县信息预留）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS regions (
            id INTEGER PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            province_id TEXT NOT NULL,
            province_name TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT 'province',
            parent_id INTEGER,
            FOREIGN KEY (parent_id) REFERENCES regions(id)
        )
    """)

    # 数据来源表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY,
            source_name TEXT NOT NULL,
            source_url TEXT NOT NULL,
            publish_org TEXT,
            publish_date TEXT,
            collect_date TEXT,
            reliability TEXT CHECK(reliability IN ('high', 'medium', 'low', 'unknown')),
            notes TEXT
        )
    """)

    # 电价政策表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS policies (
            id INTEGER PRIMARY KEY,
            region_id INTEGER NOT NULL,
            user_type TEXT NOT NULL,
            voltage_level TEXT,
            season_type TEXT,
            policy_title TEXT NOT NULL,
            policy_number TEXT,
            publish_date TEXT,
            effective_date TEXT,
            expiry_date TEXT,
            source_id INTEGER,
            data_status TEXT CHECK(data_status IN ('confirmed', 'modeled', 'estimated', 'missing', 'pending')),
            notes TEXT,
            FOREIGN KEY (region_id) REFERENCES regions(id),
            FOREIGN KEY (source_id) REFERENCES sources(id)
        )
    """)

    # 分时时段表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS time_periods (
            id INTEGER PRIMARY KEY,
            policy_id INTEGER NOT NULL,
            original_name TEXT NOT NULL,
            standard_category TEXT NOT NULL CHECK(standard_category IN ('尖峰', '峰', '平', '谷', '深谷')),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            season_type TEXT,
            price_value REAL,
            price_unit TEXT DEFAULT '元/kWh',
            data_status TEXT CHECK(data_status IN ('confirmed', 'modeled', 'estimated', 'missing', 'pending')),
            notes TEXT,
            FOREIGN KEY (policy_id) REFERENCES policies(id)
        )
    """)

    # 价格曲线数据表 —— 按小时粒度
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS price_points (
            id INTEGER PRIMARY KEY,
            region_id INTEGER NOT NULL,
            user_type TEXT NOT NULL,
            season_type TEXT,
            hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
            standard_category TEXT,
            price_value REAL,
            data_status TEXT CHECK(data_status IN ('confirmed', 'modeled', 'estimated', 'missing', 'pending')),
            FOREIGN KEY (region_id) REFERENCES regions(id)
        )
    """)

    # 缺失数据记录表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS missing_data (
            id INTEGER PRIMARY KEY,
            region_id INTEGER,
            description TEXT NOT NULL,
            missing_fields TEXT,
            reason TEXT,
            search_process TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (region_id) REFERENCES regions(id)
        )
    """)

    conn.commit()
    print("✓ 数据库表创建完成")


def import_csv_to_table(conn, table_name, csv_path):
    """从 CSV 文件导入数据到指定表"""
    if not os.path.exists(csv_path):
        print(f"✗ CSV 文件不存在: {csv_path}")
        return False

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print(f"✗ CSV 文件为空或无列名: {csv_path}")
            return False

        columns = reader.fieldnames
        placeholders = ','.join(['?' for _ in columns])
        col_names = ','.join(columns)

        rows = [list(row.values()) for row in reader]
        if not rows:
            print(f"  CSV 文件无数据行: {csv_path}")
            return False

        cursor = conn.cursor()
        cursor.execute(f"DELETE FROM {table_name}")
        cursor.executemany(
            f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders})",
            rows
        )
        conn.commit()
        print(f"✓ 导入 {table_name}: {len(rows)} 条记录")
        return True


def import_all_csv(conn):
    """导入所有 CSV 数据"""
    mapping = [
        ("regions", "regions.csv"),
        ("sources", "sources.csv"),
        ("policies", "policies.csv"),
        ("time_periods", "time_periods.csv"),
        ("price_points", "price_points.csv"),
    ]
    for table, filename in mapping:
        csv_path = os.path.join(CSV_DIR, filename)
        import_csv_to_table(conn, table, csv_path)


def insert_missing_data(conn):
    """插入缺失数据记录"""
    missing = [
        (1, "广州市居民分时电价具体时段划分", "时段划分、价格", "未检索到广州市居民分时电价的官方详细文件，仅在广东省级政策中有提及居民可选择执行", "检索了广东省发改委、广州发改委、南方电网官网，均未找到居民分时电价详细时段划分"),
        (2, "内蒙古居民和农业用电分时电价", "用户类型覆盖", "内蒙古分时电价政策目前仅覆盖工商业，居民和农业用电分时电价政策尚未找到公开文件", "检索了内蒙古发改委官网、蒙西蒙东电网公司网站"),
        (3, "各省最新代理购电价格", "代理购电价格", "各省电网代理购电价格按月发布，未静态归档到本数据库", "建议通过国网、南网每月公告获取最新代理购电价格表"),
        (4, "山东深谷电价精确计算公式", "深谷电价计算细节", "深谷在谷段基础上下浮90%来源于政策解读，但精确公式需要查阅原始公告附件PDF", "原始公告未以文本形式公开发布完整电价表"),
    ]

    cursor = conn.cursor()
    cursor.executemany(
        "INSERT INTO missing_data (region_id, description, missing_fields, reason, search_process) VALUES (?, ?, ?, ?, ?)",
        missing
    )
    conn.commit()
    print("✓ 缺失数据记录已插入")


def main():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("  ️ 删除旧的数据库文件")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    print(f"\n{'='*50}")
    print("城市分时电价观察站 - 数据库初始化")
    print(f"{'='*50}\n")

    create_tables(conn)
    import_all_csv(conn)
    insert_missing_data(conn)

    conn.close()
    print(f"\n{'='*50}")
    print(f"✓ 数据库初始化完成: {DB_PATH}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
