"""
初始数据种子脚本
城市分时电价观察站 - MVP

数据来源说明：
- 各城市发改委/物价局官方公告
- 国家电网/南方电网公开信息
- 电价信息为示例数据，用于展示功能
"""
import sqlite3
import os
from datetime import datetime, date

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "electricity_prices.db")

# ==================== 城市数据 ====================
CITIES = [
    {"name": "北京", "province": "北京", "region": "华北", "grid_company": "国家电网"},
    {"name": "上海", "province": "上海", "region": "华东", "grid_company": "国家电网"},
    {"name": "广州", "province": "广东", "region": "华南", "grid_company": "南方电网"},
    {"name": "深圳", "province": "广东", "region": "华南", "grid_company": "南方电网"},
    {"name": "杭州", "province": "浙江", "region": "华东", "grid_company": "国家电网"},
    {"name": "成都", "province": "四川", "region": "西南", "grid_company": "国家电网"},
    {"name": "武汉", "province": "湖北", "region": "华中", "grid_company": "国家电网"},
    {"name": "南京", "province": "江苏", "region": "华东", "grid_company": "国家电网"},
    {"name": "重庆", "province": "重庆", "region": "西南", "grid_company": "国家电网"},
    {"name": "西安", "province": "陕西", "region": "西北", "grid_company": "国家电网"},
]

# ==================== 数据来源 ====================
SOURCES = [
    {"source_name": "北京市发展和改革委员会", "source_type": "政府官网", 
     "url": "https://fgw.beijing.gov.cn/", "description": "北京市发改委电价政策公告", "reliability_score": 5},
    {"source_name": "上海市发展和改革委员会", "source_type": "政府官网", 
     "url": "https://fgw.sh.gov.cn/", "description": "上海市发改委电价政策公告", "reliability_score": 5},
    {"source_name": "广东省发展和改革委员会", "source_type": "政府官网", 
     "url": "https://drc.gd.gov.cn/", "description": "广东省电价政策文件", "reliability_score": 5},
    {"source_name": "浙江省发展和改革委员会", "source_type": "政府官网", 
     "url": "https://fzggw.zj.gov.cn/", "description": "浙江省发改委电价公告", "reliability_score": 5},
    {"source_name": "四川省发展和改革委员会", "source_type": "政府官网", 
     "url": "https://fgw.sc.gov.cn/", "description": "四川省电价政策", "reliability_score": 5},
    {"source_name": "湖北省发展和改革委员会", "source_type": "政府官网", 
     "url": "https://fgw.hubei.gov.cn/", "description": "湖北省电价政策公告", "reliability_score": 5},
    {"source_name": "江苏省发展和改革委员会", "source_type": "政府官网", 
     "url": "https://fzggw.jiangsu.gov.cn/", "description": "江苏省电价政策", "reliability_score": 5},
    {"source_name": "重庆市发展和改革委员会", "source_type": "政府官网", 
     "url": "https://fzggw.cq.gov.cn/", "description": "重庆市电价政策", "reliability_score": 5},
    {"source_name": "陕西省发展和改革委员会", "source_type": "政府官网", 
     "url": "https://sndrc.shaanxi.gov.cn/", "description": "陕西省电价政策", "reliability_score": 5},
    {"source_name": "国家电网官方网站", "source_type": "电网公司", 
     "url": "https://www.sgcc.com.cn/", "description": "国家电网电价信息公开", "reliability_score": 5},
    {"source_name": "南方电网官方网站", "source_type": "电网公司", 
     "url": "https://www.csg.cn/", "description": "南方电网电价信息", "reliability_score": 5},
]

# ==================== 电价数据 ====================
PRICE_DATA = {
    "北京": {
        "season": "全年",
        "periods": {"高峰": 1.1802, "平段": 0.7502, "低谷": 0.3202, "尖峰": 1.3942},
        "source_idx": 0
    },
    "上海": {
        "season": "非夏季",
        "periods": {"高峰": 1.1327, "平段": 0.7047, "低谷": 0.2837, "尖峰": 1.4247},
        "season_summer": {
            "season": "夏季",
            "periods": {"高峰": 1.1827, "平段": 0.7047, "低谷": 0.2837, "尖峰": 1.4797}
        },
        "source_idx": 1
    },
    "广州": {
        "season": "全年",
        "periods": {"高峰": 1.0138, "平段": 0.6358, "低谷": 0.2578, "尖峰": 1.2138},
        "source_idx": 2
    },
    "深圳": {
        "season": "全年",
        "periods": {"高峰": 0.9957, "平段": 0.6177, "低谷": 0.2397, "尖峰": 1.1857},
        "source_idx": 2
    },
    "杭州": {
        "season": "全年",
        "periods": {"高峰": 1.0698, "平段": 0.6968, "低谷": 0.3188, "尖峰": 1.2698},
        "source_idx": 3
    },
    "成都": {
        "season": "全年",
        "periods": {"高峰": 0.9634, "平段": 0.6434, "低谷": 0.3234, "尖峰": 1.1184},
        "source_idx": 4
    },
    "武汉": {
        "season": "全年",
        "periods": {"高峰": 1.0248, "平段": 0.6908, "低谷": 0.3568, "尖峰": 1.1948},
        "source_idx": 5
    },
    "南京": {
        "season": "全年",
        "periods": {"高峰": 1.0872, "平段": 0.7072, "低谷": 0.3272, "尖峰": 1.2672},
        "source_idx": 6
    },
    "重庆": {
        "season": "全年",
        "periods": {"高峰": 0.9456, "平段": 0.6256, "低谷": 0.3056, "尖峰": 1.0856},
        "source_idx": 7
    },
    "西安": {
        "season": "全年",
        "periods": {"高峰": 0.9321, "平段": 0.6121, "低谷": 0.2921, "尖峰": 1.0621},
        "source_idx": 8
    },
}

# ==================== 分时时段定义 ====================
PERIOD_DEFINITIONS = {
    "北京": [
        {"period_name": "高峰", "season": "全年", "start_time": "10:00", "end_time": "15:00"},
        {"period_name": "高峰", "season": "全年", "start_time": "18:00", "end_time": "21:00"},
        {"period_name": "平段", "season": "全年", "start_time": "07:00", "end_time": "10:00"},
        {"period_name": "平段", "season": "全年", "start_time": "15:00", "end_time": "18:00"},
        {"period_name": "平段", "season": "全年", "start_time": "21:00", "end_time": "23:00"},
        {"period_name": "低谷", "season": "全年", "start_time": "23:00", "end_time": "07:00"},
        {"period_name": "尖峰", "season": "全年", "start_time": "10:00", "end_time": "11:00"},
        {"period_name": "尖峰", "season": "全年", "start_time": "14:00", "end_time": "15:00"},
    ],
    "上海": [
        {"period_name": "高峰", "season": "夏季", "start_time": "08:00", "end_time": "11:00"},
        {"period_name": "高峰", "season": "夏季", "start_time": "18:00", "end_time": "21:00"},
        {"period_name": "平段", "season": "夏季", "start_time": "06:00", "end_time": "08:00"},
        {"period_name": "平段", "season": "夏季", "start_time": "11:00", "end_time": "18:00"},
        {"period_name": "平段", "season": "夏季", "start_time": "21:00", "end_time": "22:00"},
        {"period_name": "低谷", "season": "夏季", "start_time": "22:00", "end_time": "06:00"},
        {"period_name": "尖峰", "season": "夏季", "start_time": "08:00", "end_time": "11:00"},
        {"period_name": "高峰", "season": "非夏季", "start_time": "08:00", "end_time": "11:00"},
        {"period_name": "高峰", "season": "非夏季", "start_time": "18:00", "end_time": "21:00"},
        {"period_name": "平段", "season": "非夏季", "start_time": "06:00", "end_time": "08:00"},
        {"period_name": "平段", "season": "非夏季", "start_time": "11:00", "end_time": "18:00"},
        {"period_name": "平段", "season": "非夏季", "start_time": "21:00", "end_time": "22:00"},
        {"period_name": "低谷", "season": "非夏季", "start_time": "22:00", "end_time": "06:00"},
    ],
    "广州": [
        {"period_name": "高峰", "season": "全年", "start_time": "10:00", "end_time": "12:00"},
        {"period_name": "高峰", "season": "全年", "start_time": "14:00", "end_time": "19:00"},
        {"period_name": "平段", "season": "全年", "start_time": "08:00", "end_time": "10:00"},
        {"period_name": "平段", "season": "全年", "start_time": "12:00", "end_time": "14:00"},
        {"period_name": "平段", "season": "全年", "start_time": "19:00", "end_time": "22:00"},
        {"period_name": "低谷", "season": "全年", "start_time": "00:00", "end_time": "08:00"},
        {"period_name": "尖峰", "season": "全年", "start_time": "11:00", "end_time": "12:00"},
        {"period_name": "尖峰", "season": "全年", "start_time": "15:00", "end_time": "17:00"},
    ],
    "深圳": [
        {"period_name": "高峰", "season": "全年", "start_time": "10:00", "end_time": "12:00"},
        {"period_name": "高峰", "season": "全年", "start_time": "14:00", "end_time": "19:00"},
        {"period_name": "平段", "season": "全年", "start_time": "08:00", "end_time": "10:00"},
        {"period_name": "平段", "season": "全年", "start_time": "12:00", "end_time": "14:00"},
        {"period_name": "平段", "season": "全年", "start_time": "19:00", "end_time": "22:00"},
        {"period_name": "低谷", "season": "全年", "start_time": "00:00", "end_time": "08:00"},
        {"period_name": "尖峰", "season": "全年", "start_time": "11:00", "end_time": "12:00"},
        {"period_name": "尖峰", "season": "全年", "start_time": "15:00", "end_time": "17:00"},
    ],
    "杭州": [
        {"period_name": "高峰", "season": "全年", "start_time": "08:00", "end_time": "11:00"},
        {"period_name": "高峰", "season": "全年", "start_time": "13:00", "end_time": "17:00"},
        {"period_name": "高峰", "season": "全年", "start_time": "17:00", "end_time": "22:00"},
        {"period_name": "平段", "season": "全年", "start_time": "11:00", "end_time": "13:00"},
        {"period_name": "平段", "season": "全年", "start_time": "22:00", "end_time": "23:00"},
        {"period_name": "低谷", "season": "全年", "start_time": "23:00", "end_time": "07:00"},
        {"period_name": "尖峰", "season": "全年", "start_time": "08:00", "end_time": "11:00"},
    ],
}

DEFAULT_PERIODS = [
    {"period_name": "高峰", "season": "全年", "start_time": "10:00", "end_time": "15:00"},
    {"period_name": "高峰", "season": "全年", "start_time": "18:00", "end_time": "21:00"},
    {"period_name": "平段", "season": "全年", "start_time": "07:00", "end_time": "10:00"},
    {"period_name": "平段", "season": "全年", "start_time": "15:00", "end_time": "18:00"},
    {"period_name": "平段", "season": "全年", "start_time": "21:00", "end_time": "23:00"},
    {"period_name": "低谷", "season": "全年", "start_time": "23:00", "end_time": "07:00"},
    {"period_name": "尖峰", "season": "全年", "start_time": "10:00", "end_time": "11:00"},
    {"period_name": "尖峰", "season": "全年", "start_time": "14:00", "end_time": "15:00"},
]


TRENDS = {
    "北京": [(2021, 1.1502, 0.7202, 0.2902, 1.3602), (2022, 1.1602, 0.7302, 0.3002, 1.3702),
             (2023, 1.1702, 0.7402, 0.3102, 1.3802), (2024, 1.1802, 0.7502, 0.3202, 1.3942)],
    "上海": [(2021, 1.0927, 0.6647, 0.2437, 1.3847), (2022, 1.1127, 0.6847, 0.2637, 1.4047),
             (2023, 1.1227, 0.6947, 0.2737, 1.4147), (2024, 1.1327, 0.7047, 0.2837, 1.4247)],
    "广州": [(2021, 0.9738, 0.5958, 0.2178, 1.1738), (2022, 0.9938, 0.6158, 0.2378, 1.1938),
             (2023, 1.0038, 0.6258, 0.2478, 1.2038), (2024, 1.0138, 0.6358, 0.2578, 1.2138)],
}


def _get_or_create_id(cursor, table, name_col, name_val, extra_cols=None):
    """获取已有记录的ID，或插入新记录后返回ID"""
    cursor.execute(f"SELECT id FROM {table} WHERE {name_col} = ?", (name_val,))
    row = cursor.fetchone()
    if row:
        return row[0]
    return None  # caller should handle INSERT


def seed_data():
    """填充初始数据"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. 数据来源 (upsert: get or create)
    source_id_map = {}
    for src in SOURCES:
        cursor.execute("SELECT id FROM data_sources WHERE source_name = ?", (src["source_name"],))
        row = cursor.fetchone()
        if row:
            sid = row[0]
        else:
            cursor.execute('''
                INSERT INTO data_sources (source_name, source_type, url, description, retrieval_date, reliability_score)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (src["source_name"], src["source_type"], src["url"], 
                  src["description"], date.today().isoformat(), src["reliability_score"]))
            sid = cursor.lastrowid
        source_id_map[src["source_name"]] = sid
    
    # 2. 城市 (upsert)
    city_id_map = {}
    for city in CITIES:
        cursor.execute("SELECT id FROM cities WHERE name = ?", (city["name"],))
        row = cursor.fetchone()
        if row:
            cid = row[0]
        else:
            cursor.execute('''
                INSERT INTO cities (name, province, region, grid_company)
                VALUES (?, ?, ?, ?)
            ''', (city["name"], city["province"], city["region"], city["grid_company"]))
            cid = cursor.lastrowid
        city_id_map[city["name"]] = cid
    
    # 3. 分时时段的唯一约束：(city_id, period_name, season, start_time, end_time)
    # 先清空再插入（简单幂等处理）
    for city_name, periods in PERIOD_DEFINITIONS.items():
        city_id = city_id_map.get(city_name)
        if not city_id:
            continue
        cursor.execute("DELETE FROM price_periods WHERE city_id = ?", (city_id,))
        for p in periods:
            cursor.execute('''
                INSERT INTO price_periods (city_id, period_name, season, start_time, end_time)
                VALUES (?, ?, ?, ?, ?)
            ''', (city_id, p["period_name"], p["season"], p["start_time"], p["end_time"]))
    
    for city_name in [c["name"] for c in CITIES if c["name"] not in PERIOD_DEFINITIONS]:
        city_id = city_id_map.get(city_name)
        if not city_id:
            continue
        cursor.execute("DELETE FROM price_periods WHERE city_id = ?", (city_id,))
        for p in DEFAULT_PERIODS:
            cursor.execute('''
                INSERT INTO price_periods (city_id, period_name, season, start_time, end_time)
                VALUES (?, ?, ?, ?, ?)
            ''', (city_id, p["period_name"], p["season"], p["start_time"], p["end_time"]))
    
    # 4. 电价记录 — 先清空再插入（保证幂等）
    cursor.execute("DELETE FROM price_records")
    cursor.execute("DELETE FROM annual_price_trends")
    
    for city_name, data in PRICE_DATA.items():
        city_id = city_id_map.get(city_name)
        if not city_id:
            continue
        source_id = source_id_map.get(SOURCES[data["source_idx"]]["source_name"])
        
        for period_name, price in data["periods"].items():
            cursor.execute('''
                INSERT INTO price_records (city_id, period_name, voltage_level, price_per_kwh, effective_date, source_id)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (city_id, period_name, "1-10kV", price, "2025-01-01", source_id))
        
        if "season_summer" in data:
            for period_name, price in data["season_summer"]["periods"].items():
                cursor.execute('''
                    INSERT INTO price_records (city_id, period_name, voltage_level, price_per_kwh, effective_date, source_id, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (city_id, period_name, "1-10kV", price, "2025-06-01", source_id, "夏季电价（6-10月）"))
    
    # 5. 年度趋势
    for city_name, years_data in TRENDS.items():
        city_id = city_id_map.get(city_name)
        if not city_id:
            continue
        source_id = source_id_map.get(SOURCES[PRICE_DATA[city_name]["source_idx"]]["source_name"])
        for year, peak, flat, valley, spike in years_data:
            cursor.execute('''
                INSERT INTO annual_price_trends (city_id, year, peak_price, flat_price, valley_price, spike_price, source_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (city_id, year, peak, flat, valley, spike, source_id))
    
    conn.commit()
    conn.close()
    print(f"[OK] 种子数据填充完成，共 {len(CITIES)} 个城市")


if __name__ == "__main__":
    from database import init_database
    init_database()
    seed_data()
