"""
城市分时电价观察站 - 数据库初始化脚本
======================================
用法: python init_db.py

执行后将创建 SQLite 数据库并填充初始样例数据。
数据库位置: data/electricity_prices.db
"""
import os
import sys

# 确保 backend 目录可导入
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from database import init_database, DB_PATH
from seed_data import seed_data

def main():
    print("=" * 50)
    print("  城市分时电价观察站 - 数据库初始化")
    print("=" * 50)
    
    # 确保数据目录存在
    data_dir = os.path.dirname(DB_PATH)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"[*] 创建数据目录: {data_dir}")
    
    # 初始化表结构
    init_database()
    
    # 填充种子数据
    seed_data()
    
    print()
    print(f"数据库路径: {DB_PATH}")
    print(f"数据库大小: {os.path.getsize(DB_PATH) / 1024:.1f} KB")
    print()
    print("初始化完成！")
    print()
    print("启动服务: python backend/main.py")
    print("访问地址: http://127.0.0.1:8090")

if __name__ == "__main__":
    main()
