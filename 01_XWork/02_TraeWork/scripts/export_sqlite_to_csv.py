#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
城市分时电价观察站 - SQLite 数据导出 CSV 脚本
用法: python export_sqlite_to_csv.py [db_path] [csv_dir]
  默认: db_path = ../data/electricity_price.db   csv_dir = ../data/csv
"""

import csv
import sqlite3
import os
import sys
from pathlib import Path


def get_base_dir():
    return Path(__file__).parent.parent


def export_sqlite_to_csv(db_path, csv_dir):
    """将SQLite数据导出为CSV"""
    db_path = Path(db_path)
    csv_dir = Path(csv_dir)

    if not db_path.exists():
        print(f"错误: 数据库文件不存在: {db_path}")
        return False

    csv_dir.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 获取所有表名
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row['name'] for row in cursor.fetchall()]

    # 排除SQLite内部表
    export_tables = [t for t in tables if not t.startswith('sqlite_')]

    total_rows = 0
    for table_name in export_tables:
        cursor.execute(f"SELECT * FROM {table_name} ORDER BY rowid;")
        rows = cursor.fetchall()

        if not rows:
            print(f"跳过空表: {table_name}")
            continue

        # 列名
        columns = [desc[0] for desc in cursor.description]

        # 写入CSV
        csv_path = csv_dir / f"{table_name}.csv"
        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(columns)

            for row in rows:
                values = [str(row[col]) if row[col] is not None else '' for col in columns]
                writer.writerow(values)

        print(f"已导出 {table_name} -> {csv_path}: {len(rows)} 行")
        total_rows += len(rows)

    conn.close()
    print(f"\n导出完成! 共导出 {total_rows} 行数据到: {csv_dir}")
    return True


def main():
    base_dir = get_base_dir()
    db_path = base_dir / "data" / "electricity_price.db"
    csv_dir = base_dir / "data" / "csv"

    if len(sys.argv) > 1:
        db_path = Path(sys.argv[1])
    if len(sys.argv) > 2:
        csv_dir = Path(sys.argv[2])

    print(f"数据库: {db_path}")
    print(f"CSV目录: {csv_dir}")
    print("-" * 50)

    success = export_sqlite_to_csv(db_path, csv_dir)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()