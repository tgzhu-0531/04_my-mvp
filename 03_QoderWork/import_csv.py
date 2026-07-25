#!/usr/bin/env python3
"""
城市分时电价观察站 - CSV 数据导入 SQLite 脚本

用法:
    python import_csv.py

说明:
    从 data/ 目录读取 CSV 文件，导入到 sql/electricity.db 数据库。
    需要先运行 sql/init.sql 初始化数据库表结构。

依赖:
    pip install -r requirements.txt
"""

import csv
import os
import sqlite3
import sys

# 路径配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(BASE_DIR, "sql", "electricity.db")
INIT_SQL = os.path.join(BASE_DIR, "sql", "init.sql")

# 省份映射
PROVINCE_MAP = {
    "guangdong.csv": "广东",
    "jiangsu.csv": "江苏",
    "shandong.csv": "山东",
    "zhejiang.csv": "浙江",
    "innermongolia.csv": "内蒙古",
}


def init_database():
    """初始化数据库"""
    if not os.path.exists(INIT_SQL):
        print(f"[ERROR] 初始化 SQL 文件不存在: {INIT_SQL}")
        return False

    conn = sqlite3.connect(DB_PATH)
    try:
        with open(INIT_SQL, "r", encoding="utf-8") as f:
            sql = f.read()
        conn.executescript(sql)
        conn.commit()
        print(f"[OK] 数据库初始化完成: {DB_PATH}")
        return conn
    except Exception as e:
        print(f"[ERROR] 数据库初始化失败: {e}")
        conn.close()
        return None


def import_csv_to_table(conn, csv_path, table_name, columns_map):
    """
    导入 CSV 到指定表
    
    Args:
        conn: SQLite 连接
        csv_path: CSV 文件路径
        table_name: 目标表名
        columns_map: CSV 字段到数据库字段的映射 {csv_col: db_col}
    """
    if not os.path.exists(csv_path):
        print(f"[SKIP] 文件不存在: {csv_path}")
        return 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print(f"[SKIP] 空文件: {csv_path}")
        return 0

    db_columns = list(columns_map.values())
    placeholders = ", ".join(["?" for _ in db_columns])
    col_list = ", ".join(db_columns)
    sql = f"INSERT OR REPLACE INTO {table_name} ({col_list}) VALUES ({placeholders})"

    count = 0
    for row in rows:
        values = [row.get(csv_col, "") for csv_col in columns_map.keys()]
        try:
            conn.execute(sql, values)
            count += 1
        except Exception as e:
            print(f"[WARN] 行导入失败: {e}")
            print(f"  数据: {values}")

    conn.commit()
    return count


def import_price_data(conn):
    """导入各省电价数据到 time_periods 表"""
    csv_files = [f for f in os.listdir(DATA_DIR) if f.endswith(".csv") and f in PROVINCE_MAP]
    total = 0

    for csv_file in csv_files:
        province = PROVINCE_MAP[csv_file]
        csv_path = os.path.join(DATA_DIR, csv_file)

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        for row in rows:
            # 获取省份ID
            cursor = conn.execute("SELECT id FROM provinces WHERE name = ?", (province,))
            prov_row = cursor.fetchone()
            if not prov_row:
                print(f"[WARN] 找不到省份: {province}")
                continue
            province_id = prov_row[0]

            conn.execute(
                """INSERT INTO time_periods 
                (province_id, user_type, voltage_level, season, period_name, 
                 standard_category, start_time, end_time, price, unit,
                 effective_date, remark)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    province_id,
                    row.get("user_type", ""),
                    row.get("voltage_level", ""),
                    row.get("season", ""),
                    row.get("period_name", ""),
                    row.get("standard_category", ""),
                    row.get("start_time", ""),
                    row.get("end_time", ""),
                    float(row.get("price", 0)) if row.get("price") else None,
                    row.get("unit", "元/kWh"),
                    row.get("effective_date", ""),
                    row.get("remark", ""),
                ),
            )
            total += 1

        print(f"[OK] {province}: {len(rows)} 条时段数据导入")

    conn.commit()
    return total


def import_sources(conn):
    """导入数据来源"""
    csv_path = os.path.join(DATA_DIR, "sources.csv")
    if not os.path.exists(csv_path):
        print("[SKIP] sources.csv 不存在")
        return 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    for row in rows:
        cursor = conn.execute("SELECT id FROM provinces WHERE name = ?", (row.get("province", ""),))
        prov_row = cursor.fetchone()
        province_id = prov_row[0] if prov_row else None
        if not province_id:
            continue

        conn.execute(
            """INSERT INTO sources (province_id, url, publishing_org, publish_time, 
             collection_time, reliability, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                province_id,
                row.get("url", ""),
                row.get("publishing_org", ""),
                row.get("publish_time", ""),
                row.get("collection_time", ""),
                row.get("reliability", ""),
                row.get("remark", ""),
            ),
        )

    conn.commit()
    print(f"[OK] 数据来源: {len(rows)} 条导入")
    return len(rows)


def import_missing(conn):
    """导入缺失数据记录"""
    csv_path = os.path.join(DATA_DIR, "missing_data.csv")
    if not os.path.exists(csv_path):
        print("[SKIP] missing_data.csv 不存在")
        return 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    for row in rows:
        cursor = conn.execute("SELECT id FROM provinces WHERE name = ?", (row.get("province", ""),))
        prov_row = cursor.fetchone()
        province_id = prov_row[0] if prov_row else None
        if not province_id:
            continue

        conn.execute(
            """INSERT INTO missing_data (province_id, field_name, description, reason)
            VALUES (?, ?, ?, ?)""",
            (
                province_id,
                row.get("field", ""),
                row.get("description", ""),
                row.get("reason", ""),
            ),
        )

    conn.commit()
    print(f"[OK] 缺失数据: {len(rows)} 条导入")
    return len(rows)


def verify():
    """验证数据完整性"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\n===== 数据验证 =====")
    
    # 省份
    cursor.execute("SELECT id, name, status FROM provinces ORDER BY id")
    provinces = cursor.fetchall()
    print(f"\n省份 ({len(provinces)}):")
    for p in provinces:
        print(f"  [{p[0]}] {p[1]} ({p[2]})")

    # 时段
    cursor.execute("""
        SELECT p.name, COUNT(tp.id) 
        FROM provinces p 
        LEFT JOIN time_periods tp ON tp.province_id = p.id 
        GROUP BY p.name 
        ORDER BY p.id
    """)
    periods = cursor.fetchall()
    print(f"\n分时时段:")
    for p in periods:
        print(f"  {p[0]}: {p[1]} 条")

    # 来源
    cursor.execute("SELECT COUNT(*) FROM sources")
    print(f"\n数据来源: {cursor.fetchone()[0]} 条")

    # 缺失
    cursor.execute("SELECT COUNT(*) FROM missing_data")
    print(f"缺失记录: {cursor.fetchone()[0]} 条")

    # 总体统计
    cursor.execute("""
        SELECT ROUND(AVG(tp.price), 4), MIN(tp.price), MAX(tp.price)
        FROM time_periods tp WHERE tp.price IS NOT NULL
    """)
    stats = cursor.fetchone()
    print(f"\n电价统计:")
    print(f"  平均: {stats[0]} 元/kWh")
    print(f"  最低: {stats[1]} 元/kWh")
    print(f"  最高: {stats[2]} 元/kWh")

    conn.close()


def main():
    print("=" * 50)
    print("  城市分时电价观察站 - 数据导入工具")
    print("=" * 50)

    # 初始化数据库
    conn = init_database()
    if not conn:
        sys.exit(1)

    try:
        # 导入数据
        total_periods = import_price_data(conn)
        total_sources = import_sources(conn)
        total_missing = import_missing(conn)

        print(f"\n{'=' * 50}")
        print(f"  导入完成:")
        print(f"    分时时段: {total_periods} 条")
        print(f"    数据来源: {total_sources} 条")
        print(f"    缺失记录: {total_missing} 条")
        print(f"{'=' * 50}")

        # 验证
        verify()

    finally:
        conn.close()


if __name__ == "__main__":
    main()
