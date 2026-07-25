#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
城市分时电价观察站 - CSV 数据导入 SQLite 脚本
用法: python import_csv_to_sqlite.py [csv_dir] [db_path]
  默认: csv_dir = ../data/csv   db_path = ../data/electricity_price.db
"""

import csv
import sqlite3
import os
import sys
from pathlib import Path


def get_base_dir():
    """获取脚本所在目录的上级目录"""
    return Path(__file__).parent.parent


def read_csv(filepath):
    """读取CSV文件并返回列名和行数据"""
    rows = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 清理空字符串，兼容非字符串类型
            cleaned = {}
            for k, v in row.items():
                if v is None:
                    cleaned[k] = ''
                elif isinstance(v, (list, tuple)):
                    cleaned[k] = ','.join(str(x) for x in v)
                else:
                    cleaned[k] = str(v).strip()
            rows.append(cleaned)
    return rows


def csv_to_sqlite(csv_dir, db_path):
    """将CSV数据导入SQLite"""
    csv_dir = Path(csv_dir)
    db_path = Path(db_path)

    if not csv_dir.exists():
        print(f"错误: CSV目录不存在: {csv_dir}")
        return False

    # 确保数据库目录存在
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # 删除已有数据库文件
    if db_path.exists():
        db_path.unlink()
        print(f"已删除旧数据库: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    # 先执行初始化SQL创建表结构
    sql_init = csv_dir.parent / "sql" / "01_init.sql"
    if sql_init.exists():
        with open(sql_init, 'r', encoding='utf-8') as f:
            sql = f.read()
        cursor.executescript(sql)
        print(f"已执行建表SQL: {sql_init}")
    else:
        print(f"警告: 未找到建表SQL文件: {sql_init}")
        print("请先运行 01_init.sql 创建表结构")
        return False

    # CSV文件映射: (文件名, 表名)
    csv_files = [
        ("regions.csv", "regions"),
        ("data_sources.csv", "data_sources"),
        ("policies.csv", "policies"),
        ("periods.csv", "periods"),
        ("missing_records.csv", "missing_records"),
    ]

    total_rows = 0
    for csv_file, table_name in csv_files:
        csv_path = csv_dir / csv_file
        if not csv_path.exists():
            print(f"警告: CSV文件不存在: {csv_path}")
            continue

        rows = read_csv(csv_path)
        if not rows:
            print(f"跳过空文件: {csv_file}")
            continue

        # 获取列名
        columns = list(rows[0].keys())
        placeholders = ','.join(['?' for _ in columns])
        col_names = ','.join(columns)

        # 准备数据（逐行处理，避免 batch 事务回滚问题）
        sql = f"INSERT OR IGNORE INTO {table_name} ({col_names}) VALUES ({placeholders})"
        row_count = 0
        error_count = 0
        for i, row in enumerate(rows):
            values = []
            for col in columns:
                val = row.get(col, '')
                # 空字符串转为None(对应SQLite的NULL)
                if val == '':
                    values.append(None)
                else:
                    # 尝试转换为浮点数
                    try:
                        values.append(float(val))
                    except (ValueError, TypeError):
                        values.append(val)
            try:
                cursor.execute(sql, values)
                if cursor.rowcount > 0:
                    row_count += 1
                else:
                    # INSERT OR IGNORE 跳过了重复行
                    pass
            except sqlite3.IntegrityError as e2:
                error_count += 1
                print(f"  ⚠ {csv_file} 第 {i+1} 行错误: {e2} (值: {values[:3]}...)")
            except Exception as e2:
                error_count += 1
                print(f"  ⚠ {csv_file} 第 {i+1} 行错误: {e2}")

        conn.commit()
        if error_count > 0:
            print(f"已导入 {csv_file} -> {table_name}: {row_count} 行 (跳过 {error_count} 行错误)")
        else:
            print(f"已导入 {csv_file} -> {table_name}: {row_count} 行")
        total_rows += row_count

    conn.close()
    print(f"\n导入完成! 共导入 {total_rows} 行数据到: {db_path}")
    return True


def main():
    base_dir = get_base_dir()
    csv_dir = base_dir / "data" / "csv"
    db_path = base_dir / "data" / "electricity_price.db"

    # 命令行参数覆盖
    if len(sys.argv) > 1:
        csv_dir = Path(sys.argv[1])
    if len(sys.argv) > 2:
        db_path = Path(sys.argv[2])

    print(f"CSV目录: {csv_dir}")
    print(f"数据库: {db_path}")
    print("-" * 50)

    success = csv_to_sqlite(csv_dir, db_path)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()