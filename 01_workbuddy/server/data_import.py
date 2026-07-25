"""
数据导入脚本 - 初始化 SQLite 数据库并导出 CSV
"""
import sys, csv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # 项目根目录
DB_PATH = BASE_DIR / 'data' / 'electricity_pricing.db'
SCHEMA_PATH = BASE_DIR / 'data' / 'schema.sql'
SEED_PATH = BASE_DIR / 'data' / 'seed.sql'
CSV_DIR = BASE_DIR / 'data' / 'csv'
TABLES = ['regions', 'policies', 'time_periods', 'data_sources', 'missing_records']

import sqlite3


def init_database():
    """初始化 SQLite 数据库"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript("PRAGMA foreign_keys=OFF;")

    if SCHEMA_PATH.exists():
        conn.executescript(SCHEMA_PATH.read_text(encoding='utf-8'))
        print(f"[OK] 表结构创建完成")

    if SEED_PATH.exists():
        conn.executescript(SEED_PATH.read_text(encoding='utf-8'))
        print(f"[OK] 种子数据导入完成")

    conn.execute("PRAGMA foreign_keys=ON;")
    conn.commit()
    conn.close()
    print(f"[OK] 数据库: {DB_PATH}")


def export_csv():
    """导出 CSV 数据文件"""
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))

    for table in TABLES:
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            continue
        filepath = CSV_DIR / f"{table}.csv"
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([d[1] for d in conn.execute(f"PRAGMA table_info({table})").fetchall()])
            for row in rows:
                writer.writerow(row)
        print(f"[OK] 已导出 {table}.csv ({len(rows)} 条记录)")

    conn.close()
    print(f"[OK] CSV 已导出到: {CSV_DIR}")


if __name__ == '__main__':
    print("=" * 50)
    print("城市分时电价观察站 - 数据导入")
    print("=" * 50)
    init_database()
    export_csv()
    print("\n✅ 完成！")
    print("  - sqlite 模式: 直接启动 server/app.py")
    print("  - csv 模式:    config.json 已默认设为 csv")
    print("  修改 config.json 中的 selected 字段切换（'csv' 或 'sqlite'）")
