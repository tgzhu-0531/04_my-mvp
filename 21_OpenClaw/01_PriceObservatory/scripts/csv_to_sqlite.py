#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
城市分时电价观察站 MVP - CSV 转 SQLite 工具
用法: python csv_to_sqlite.py --csv-dir ../site/data/ --db ../database/electricity_prices.db
"""

import csv
import sqlite3
import os
import argparse
from pathlib import Path


def create_tables(conn):
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS provinces (
            province_id TEXT PRIMARY KEY,
            province_name TEXT NOT NULL,
            province_abbr TEXT NOT NULL,
            region TEXT NOT NULL,
            data_status TEXT DEFAULT 'verified',
            notes TEXT
        );
        CREATE TABLE IF NOT EXISTS tariff_types (
            type_id TEXT PRIMARY KEY,
            type_name TEXT NOT NULL,
            province_id TEXT NOT NULL,
            voltage_level TEXT NOT NULL,
            user_category TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (province_id) REFERENCES provinces(province_id)
        );
        CREATE TABLE IF NOT EXISTS prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            province_id TEXT NOT NULL,
            type_id TEXT NOT NULL,
            season TEXT NOT NULL,
            original_period_name TEXT NOT NULL,
            standard_category TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            price_yuan_per_kwh REAL NOT NULL,
            effective_date TEXT NOT NULL,
            expiry_date TEXT,
            source_id TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (province_id) REFERENCES provinces(province_id),
            FOREIGN KEY (type_id) REFERENCES tariff_types(type_id),
            FOREIGN KEY (source_id) REFERENCES data_sources(source_id)
        );
        CREATE TABLE IF NOT EXISTS data_sources (
            source_id TEXT PRIMARY KEY,
            source_name TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_url TEXT NOT NULL,
            publish_date TEXT,
            collect_date TEXT,
            reliability TEXT DEFAULT 'medium',
            province_id TEXT,
            notes TEXT,
            FOREIGN KEY (province_id) REFERENCES provinces(province_id)
        );
    """)
    conn.commit()


def import_csv_to_table(conn, csv_path, table_name, mapping=None):
    """Import CSV file into SQLite table."""
    if not os.path.exists(csv_path):
        print(f"  [SKIP] {csv_path} not found")
        return 0
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    if not rows:
        print(f"  [SKIP] {csv_path} is empty")
        return 0
    
    columns = list(rows[0].keys())
    placeholders = ','.join(['?' for _ in columns])
    col_names = ','.join(columns)
    
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {table_name}")
    
    count = 0
    for row in rows:
        values = [row[col] for col in columns]
        cursor.execute(f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders})", values)
        count += 1
    
    conn.commit()
    return count


def main():
    parser = argparse.ArgumentParser(description='CSV to SQLite converter for Price Observatory')
    parser.add_argument('--csv-dir', default='../site/data/', help='CSV files directory')
    parser.add_argument('--db', default='../database/electricity_prices.db', help='SQLite database path')
    args = parser.parse_args()
    
    csv_dir = Path(args.csv_dir).resolve()
    db_path = Path(args.db).resolve()
    
    print(f"CSV directory: {csv_dir}")
    print(f"Database: {db_path}")
    
    # Ensure parent directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Connect to database (creates if not exists)
    conn = sqlite3.connect(str(db_path))
    
    # Create tables
    print("\nCreating tables...")
    create_tables(conn)
    
    # Import data
    table_map = {
        'provinces.csv': 'provinces',
        'tariff_types.csv': 'tariff_types',
        'prices.csv': 'prices',
        'data_sources.csv': 'data_sources',
    }
    
    print("\nImporting CSV files...")
    total = 0
    for csv_file, table in table_map.items():
        csv_path = csv_dir / csv_file
        count = import_csv_to_table(conn, str(csv_path), table)
        print(f"  {csv_file} -> {table}: {count} rows")
        total += count
    
    print(f"\nTotal: {total} rows imported to {db_path}")
    conn.close()


if __name__ == '__main__':
    main()
