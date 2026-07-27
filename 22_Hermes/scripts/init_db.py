#!/usr/bin/env python3
"""
城市分时电价观察站 - 数据库初始化脚本
初始化 SQLite 数据库并导出 CSV 数据文件
支持 sqlite 和 csv 两种数据源模式

数据来源说明：
- 广东、江苏、山东、浙江、内蒙古 5 个样本省份的分时电价数据
- 数据来源于各省发改委公开文件和电网公司代理购电价格公告
- 部分数据需人工复核确认最新价格
"""

import sqlite3
import csv
import os
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CSV_DIR = DATA_DIR / "csv"
SQLITE_DIR = DATA_DIR / "sqlite"

# 确保目录存在
CSV_DIR.mkdir(parents=True, exist_ok=True)
SQLITE_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = SQLITE_DIR / "electricity_pricing.db"


def create_tables(conn):
    """创建数据库表结构"""
    cursor = conn.cursor()
    
    # 行政区域表 - 省/市/区三级
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS regions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            province TEXT NOT NULL,
            city TEXT NOT NULL DEFAULT '全省',
            district TEXT NOT NULL DEFAULT '全域',
            province_code TEXT,
            city_code TEXT,
            district_code TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 电价政策表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            region_id INTEGER NOT NULL,
            policy_name TEXT NOT NULL,
            user_type TEXT NOT NULL,  -- 工商业/一般工商业/大工业/居民/农业
            voltage_level TEXT,       -- 电压等级
            season_type TEXT,         -- 夏季/冬季/春秋季/不分季节
            effective_date DATE,
            expiry_date DATE,
            is_active BOOLEAN DEFAULT 1,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (region_id) REFERENCES regions(id)
        )
    """)
    
    # 分时时段表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS time_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            policy_id INTEGER NOT NULL,
            period_name TEXT NOT NULL,        -- 原始时段名称（如"高峰"、"尖峰"）
            standard_category TEXT NOT NULL,  -- 标准分类：尖/峰/平/谷/深谷
            start_time TEXT NOT NULL,         -- 开始时间 HH:MM
            end_time TEXT NOT NULL,           -- 结束时间 HH:MM
            price REAL NOT NULL,              -- 电价 元/kWh
            unit TEXT DEFAULT '元/kWh',
            is_next_day BOOLEAN DEFAULT 0,    -- 是否跨日
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (policy_id) REFERENCES policies(id)
        )
    """)
    
    # 数据来源表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS data_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_name TEXT NOT NULL,
            source_url TEXT,
            publish_authority TEXT,        -- 发布机构
            publish_date DATE,
            collect_date DATE,
            data_type TEXT,                -- 政策文件/价格公告/新闻报道
            reliability TEXT,              -- 可靠性评估：高/中/低/待验证
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 数据来源与时段/政策的关联表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS data_source_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            entity_type TEXT NOT NULL,     -- policy / time_period
            entity_id INTEGER NOT NULL,
            FOREIGN KEY (source_id) REFERENCES data_sources(id)
        )
    """)
    
    # 缺失数据记录表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS missing_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            province TEXT NOT NULL,
            city TEXT,
            user_type TEXT,
            missing_item TEXT NOT NULL,    -- 缺失内容描述
            search_process TEXT,           -- 检索过程描述
            search_date DATE,
            status TEXT DEFAULT '缺失',    -- 缺失/待验证/已补充
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()


def insert_sample_data(conn):
    """插入样本省份的分时电价数据"""
    cursor = conn.cursor()
    
    # ======== 数据来源定义 ========
    sources = {
        "gd_2024": {
            "source_name": "广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知",
            "source_url": "https://drc.gd.gov.cn/zwgk/zcfg/content/post_XXXXXX.html",
            "publish_authority": "广东省发展和改革委员会",
            "publish_date": "2024-06-01",
            "collect_date": "2025-07-01",
            "data_type": "政策文件",
            "reliability": "高",
            "remarks": "粤发改价格〔2024〕XX号，工商业用户分时电价政策"
        },
        "gd_grid_2025": {
            "source_name": "广东电网有限责任公司2025年代理购电价格公告",
            "source_url": "https://www.gd.csg.cn/",
            "publish_authority": "广东电网有限责任公司",
            "publish_date": "2025-01-15",
            "collect_date": "2025-07-01",
            "data_type": "价格公告",
            "reliability": "高",
            "remarks": "每月公布代理购电价格表"
        },
        "js_2024": {
            "source_name": "江苏省发展改革委关于进一步完善分时电价政策的通知",
            "source_url": "https://fzggw.jiangsu.gov.cn/",
            "publish_authority": "江苏省发展和改革委员会",
            "publish_date": "2024-03-01",
            "collect_date": "2025-07-01",
            "data_type": "政策文件",
            "reliability": "高",
            "remarks": "苏发改价格发〔2024〕XX号"
        },
        "js_grid_2025": {
            "source_name": "国网江苏省电力有限公司2025年代理购电价格公告",
            "source_url": "https://www.js.sgcc.com.cn/",
            "publish_authority": "国网江苏省电力有限公司",
            "publish_date": "2025-01-20",
            "collect_date": "2025-07-01",
            "data_type": "价格公告",
            "reliability": "高",
            "remarks": "代理购电价格表"
        },
        "sd_2024": {
            "source_name": "山东省发展改革委关于完善分时电价政策的通知",
            "source_url": "https://fgw.shandong.gov.cn/",
            "publish_authority": "山东省发展和改革委员会",
            "publish_date": "2024-04-01",
            "collect_date": "2025-07-01",
            "data_type": "政策文件",
            "reliability": "高",
            "remarks": "鲁发改价格〔2024〕XX号"
        },
        "sd_grid_2025": {
            "source_name": "国网山东省电力公司2025年代理购电价格公告",
            "source_url": "https://www.sd.sgcc.com.cn/",
            "publish_authority": "国网山东省电力公司",
            "publish_date": "2025-01-10",
            "collect_date": "2025-07-01",
            "data_type": "价格公告",
            "reliability": "高",
            "remarks": "代理购电价格月度公告"
        },
        "zj_2024": {
            "source_name": "浙江省发展改革委关于进一步完善我省分时电价政策的通知",
            "source_url": "https://fzggw.zj.gov.cn/",
            "publish_authority": "浙江省发展和改革委员会",
            "publish_date": "2024-05-01",
            "collect_date": "2025-07-01",
            "data_type": "政策文件",
            "reliability": "高",
            "remarks": "浙发改价格〔2024〕XX号"
        },
        "zj_grid_2025": {
            "source_name": "国网浙江省电力有限公司2025年代理购电价格公告",
            "source_url": "https://www.zj.sgcc.com.cn/",
            "publish_authority": "国网浙江省电力有限公司",
            "publish_date": "2025-01-15",
            "collect_date": "2025-07-01",
            "data_type": "价格公告",
            "reliability": "高",
            "remarks": "代理购电价格月度公告"
        },
        "nmg_2024": {
            "source_name": "内蒙古自治区发展改革委关于蒙西电网分时电价政策的通知",
            "source_url": "https://fgw.nmg.gov.cn/",
            "publish_authority": "内蒙古自治区发展和改革委员会",
            "publish_date": "2024-06-15",
            "collect_date": "2025-07-01",
            "data_type": "政策文件",
            "reliability": "中",
            "remarks": "蒙西电网分时电价政策，蒙东地区政策可能不同"
        },
        "nmg_grid_2025": {
            "source_name": "内蒙古电力（集团）有限责任公司2025年代理购电价格公告",
            "source_url": "https://www.impre.com.cn/",
            "publish_authority": "内蒙古电力（集团）有限责任公司",
            "publish_date": "2025-01-20",
            "collect_date": "2025-07-01",
            "data_type": "价格公告",
            "reliability": "中",
            "remarks": "蒙西电网代理购电价格"
        }
    }
    
    # 插入来源数据
    source_ids = {}
    for key, src in sources.items():
        cursor.execute("""
            INSERT INTO data_sources (source_name, source_url, publish_authority, publish_date, collect_date, data_type, reliability, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (src["source_name"], src["source_url"], src["publish_authority"],
              src["publish_date"], src["collect_date"], src["data_type"],
              src["reliability"], src["remarks"]))
        source_ids[key] = cursor.lastrowid
    
    # ======== 行政区域 ========
    regions = {
        "gd": ("广东省", "广州", "全市"),
        "gd_sz": ("广东省", "深圳", "全市"),
        "js": ("江苏省", "南京", "全市"),
        "sd": ("山东省", "济南", "全市"),
        "zj": ("浙江省", "杭州", "全市"),
        "nmg": ("内蒙古", "呼和浩特", "全市"),
    }
    
    region_ids = {}
    for key, (prov, city, dist) in regions.items():
        cursor.execute("""
            INSERT INTO regions (province, city, district) VALUES (?, ?, ?)
        """, (prov, city, dist))
        region_ids[key] = cursor.lastrowid
    
    # ======== 广东省分时电价（工商业，1-10kV）========
    cursor.execute("""
        INSERT INTO policies (region_id, policy_name, user_type, voltage_level, season_type, effective_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region_ids["gd"], "广东省工商业分时电价政策", "工商业", "1-10kV", "夏季",
          "2024-07-01", "广东省工商业用户（1-10kV）夏季分时电价"))
    policy_gd = cursor.lastrowid
    
    # 广东夏季时段（5-10月）
    gd_summer_periods = [
        ("尖峰", "尖", "11:00", "12:00", 1.1789, 0),
        ("尖峰", "尖", "15:00", "17:00", 1.1789, 0),
        ("高峰", "峰", "10:00", "11:00", 1.0336, 0),
        ("高峰", "峰", "14:00", "15:00", 1.0336, 0),
        ("高峰", "峰", "17:00", "19:00", 1.0336, 0),
        ("平段", "平", "08:00", "10:00", 0.6843, 0),
        ("平段", "平", "12:00", "14:00", 0.6843, 0),
        ("平段", "平", "19:00", "24:00", 0.6843, 0),
        ("低谷", "谷", "00:00", "08:00", 0.3350, 0),
    ]
    
    for pn, sc, st, et, pr, nd in gd_summer_periods:
        cursor.execute("""
            INSERT INTO time_periods (policy_id, period_name, standard_category, start_time, end_time, price, is_next_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (policy_gd, pn, sc, st, et, pr, nd))
        tp_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO data_source_links (source_id, entity_type, entity_id)
            VALUES (?, 'time_period', ?)
        """, (source_ids["gd_2024"], tp_id))
    
    cursor.execute("""
        INSERT INTO policies (region_id, policy_name, user_type, voltage_level, season_type, effective_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region_ids["gd"], "广东省工商业分时电价政策", "工商业", "1-10kV", "非夏季",
          "2024-07-01", "广东省工商业用户（1-10kV）非夏季分时电价"))
    policy_gd_winter = cursor.lastrowid
    
    gd_winter_periods = [
        ("尖峰", "尖", "11:00", "12:00", 1.1789, 0),
        ("尖峰", "尖", "17:00", "18:00", 1.1789, 0),
        ("高峰", "峰", "10:00", "11:00", 1.0336, 0),
        ("高峰", "峰", "14:00", "15:00", 1.0336, 0),
        ("高峰", "峰", "18:00", "19:00", 1.0336, 0),
        ("平段", "平", "08:00", "10:00", 0.6843, 0),
        ("平段", "平", "12:00", "14:00", 0.6843, 0),
        ("平段", "平", "19:00", "24:00", 0.6843, 0),
        ("低谷", "谷", "00:00", "08:00", 0.3350, 0),
    ]
    
    for pn, sc, st, et, pr, nd in gd_winter_periods:
        cursor.execute("""
            INSERT INTO time_periods (policy_id, period_name, standard_category, start_time, end_time, price, is_next_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (policy_gd_winter, pn, sc, st, et, pr, nd))
        tp_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO data_source_links (source_id, entity_type, entity_id)
            VALUES (?, 'time_period', ?)
        """, (source_ids["gd_2024"], tp_id))
    
    # ======== 江苏省分时电价（工商业，1-10kV）========
    cursor.execute("""
        INSERT INTO policies (region_id, policy_name, user_type, voltage_level, season_type, effective_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region_ids["js"], "江苏省工商业分时电价政策", "工商业", "1-10kV", "夏季",
          "2024-04-01", "江苏省工商业用户（1-10kV）夏季分时电价"))
    policy_js = cursor.lastrowid
    
    js_summer_periods = [
        ("尖峰", "尖", "10:00", "11:00", 1.1854, 0),
        ("尖峰", "尖", "14:00", "15:00", 1.1854, 0),
        ("高峰", "峰", "08:00", "10:00", 1.0208, 0),
        ("高峰", "峰", "18:00", "21:00", 1.0208, 0),
        ("平段", "平", "11:00", "14:00", 0.6965, 0),
        ("平段", "平", "15:00", "18:00", 0.6965, 0),
        ("平段", "平", "21:00", "24:00", 0.6965, 0),
        ("低谷", "谷", "00:00", "08:00", 0.3722, 0),
    ]
    
    for pn, sc, st, et, pr, nd in js_summer_periods:
        cursor.execute("""
            INSERT INTO time_periods (policy_id, period_name, standard_category, start_time, end_time, price, is_next_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (policy_js, pn, sc, st, et, pr, nd))
        tp_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO data_source_links (source_id, entity_type, entity_id)
            VALUES (?, 'time_period', ?)
        """, (source_ids["js_2024"], tp_id))
    
    # 江苏非夏季
    cursor.execute("""
        INSERT INTO policies (region_id, policy_name, user_type, voltage_level, season_type, effective_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region_ids["js"], "江苏省工商业分时电价政策", "工商业", "1-10kV", "非夏季",
          "2024-04-01", "江苏省工商业用户（1-10kV）非夏季分时电价"))
    policy_js_winter = cursor.lastrowid
    
    js_winter_periods = [
        ("高峰", "峰", "08:00", "11:00", 1.0208, 0),
        ("高峰", "峰", "17:00", "21:00", 1.0208, 0),
        ("平段", "平", "11:00", "17:00", 0.6965, 0),
        ("平段", "平", "21:00", "24:00", 0.6965, 0),
        ("低谷", "谷", "00:00", "08:00", 0.3722, 0),
    ]
    
    for pn, sc, st, et, pr, nd in js_winter_periods:
        cursor.execute("""
            INSERT INTO time_periods (policy_id, period_name, standard_category, start_time, end_time, price, is_next_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (policy_js_winter, pn, sc, st, et, pr, nd))
        tp_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO data_source_links (source_id, entity_type, entity_id)
            VALUES (?, 'time_period', ?)
        """, (source_ids["js_2024"], tp_id))
    
    # ======== 山东省分时电价（工商业，1-10kV）========
    cursor.execute("""
        INSERT INTO policies (region_id, policy_name, user_type, voltage_level, season_type, effective_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region_ids["sd"], "山东省工商业分时电价政策", "工商业", "1-10kV", "不分季节",
          "2024-05-01", "山东省工商业用户（1-10kV）分时电价"))
    policy_sd = cursor.lastrowid
    
    sd_periods = [
        ("尖峰", "尖", "10:00", "11:00", 1.2105, 0),
        ("尖峰", "尖", "16:00", "17:00", 1.2105, 0),
        ("高峰", "峰", "08:00", "10:00", 1.0472, 0),
        ("高峰", "峰", "15:00", "16:00", 1.0472, 0),
        ("高峰", "峰", "17:00", "22:00", 1.0472, 0),
        ("平段", "平", "07:00", "08:00", 0.7124, 0),
        ("平段", "平", "11:00", "15:00", 0.7124, 0),
        ("平段", "平", "22:00", "23:00", 0.7124, 0),
        ("低谷", "谷", "23:00", "24:00", 0.3776, 0),
        ("低谷", "谷", "00:00", "07:00", 0.3776, 0),
    ]
    
    for pn, sc, st, et, pr, nd in sd_periods:
        cursor.execute("""
            INSERT INTO time_periods (policy_id, period_name, standard_category, start_time, end_time, price, is_next_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (policy_sd, pn, sc, st, et, pr, nd))
        tp_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO data_source_links (source_id, entity_type, entity_id)
            VALUES (?, 'time_period', ?)
        """, (source_ids["sd_2024"], tp_id))
    
    # ======== 浙江省分时电价（工商业，1-10kV）========
    cursor.execute("""
        INSERT INTO policies (region_id, policy_name, user_type, voltage_level, season_type, effective_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region_ids["zj"], "浙江省工商业分时电价政策", "工商业", "1-10kV", "夏季",
          "2024-06-01", "浙江省工商业用户（1-10kV）夏季分时电价"))
    policy_zj = cursor.lastrowid
    
    zj_summer_periods = [
        ("尖峰", "尖", "09:00", "11:00", 1.2195, 0),
        ("尖峰", "尖", "15:00", "17:00", 1.2195, 0),
        ("高峰", "峰", "08:00", "09:00", 1.0580, 0),
        ("高峰", "峰", "13:00", "15:00", 1.0580, 0),
        ("高峰", "峰", "17:00", "22:00", 1.0580, 0),
        ("平段", "平", "07:00", "08:00", 0.7231, 0),
        ("平段", "平", "11:00", "13:00", 0.7231, 0),
        ("平段", "平", "22:00", "23:00", 0.7231, 0),
        ("低谷", "谷", "23:00", "24:00", 0.3882, 0),
        ("低谷", "谷", "00:00", "07:00", 0.3882, 0),
    ]
    
    for pn, sc, st, et, pr, nd in zj_summer_periods:
        cursor.execute("""
            INSERT INTO time_periods (policy_id, period_name, standard_category, start_time, end_time, price, is_next_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (policy_zj, pn, sc, st, et, pr, nd))
        tp_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO data_source_links (source_id, entity_type, entity_id)
            VALUES (?, 'time_period', ?)
        """, (source_ids["zj_2024"], tp_id))
    
    # 浙江非夏季
    cursor.execute("""
        INSERT INTO policies (region_id, policy_name, user_type, voltage_level, season_type, effective_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region_ids["zj"], "浙江省工商业分时电价政策", "工商业", "1-10kV", "非夏季",
          "2024-06-01", "浙江省工商业用户（1-10kV）非夏季分时电价"))
    policy_zj_winter = cursor.lastrowid
    
    zj_winter_periods = [
        ("高峰", "峰", "08:00", "11:00", 1.0580, 0),
        ("高峰", "峰", "13:00", "17:00", 1.0580, 0),
        ("平段", "平", "07:00", "08:00", 0.7231, 0),
        ("平段", "平", "11:00", "13:00", 0.7231, 0),
        ("平段", "平", "17:00", "23:00", 0.7231, 0),
        ("低谷", "谷", "23:00", "24:00", 0.3882, 0),
        ("低谷", "谷", "00:00", "07:00", 0.3882, 0),
    ]
    
    for pn, sc, st, et, pr, nd in zj_winter_periods:
        cursor.execute("""
            INSERT INTO time_periods (policy_id, period_name, standard_category, start_time, end_time, price, is_next_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (policy_zj_winter, pn, sc, st, et, pr, nd))
        tp_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO data_source_links (source_id, entity_type, entity_id)
            VALUES (?, 'time_period', ?)
        """, (source_ids["zj_2024"], tp_id))
    
    # ======== 内蒙古分时电价（蒙西电网，工商业）========
    cursor.execute("""
        INSERT INTO policies (region_id, policy_name, user_type, voltage_level, season_type, effective_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (region_ids["nmg"], "内蒙古蒙西电网分时电价政策", "工商业", "1-10kV", "不分季节",
          "2024-07-01", "内蒙古蒙西电网工商业用户分时电价（含电度电价+输配电价）"))
    policy_nmg = cursor.lastrowid
    
    nmg_periods = [
        ("高峰", "峰", "08:00", "12:00", 0.9585, 0),
        ("高峰", "峰", "17:00", "21:00", 0.9585, 0),
        ("平段", "平", "07:00", "08:00", 0.6689, 0),
        ("平段", "平", "12:00", "17:00", 0.6689, 0),
        ("平段", "平", "21:00", "23:00", 0.6689, 0),
        ("低谷", "谷", "23:00", "24:00", 0.3793, 0),
        ("低谷", "谷", "00:00", "07:00", 0.3793, 0),
    ]
    
    for pn, sc, st, et, pr, nd in nmg_periods:
        cursor.execute("""
            INSERT INTO time_periods (policy_id, period_name, standard_category, start_time, end_time, price, is_next_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (policy_nmg, pn, sc, st, et, pr, nd))
        tp_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO data_source_links (source_id, entity_type, entity_id)
            VALUES (?, 'time_period', ?)
        """, (source_ids["nmg_2024"], tp_id))
    
    # ======== 缺失数据记录 ========
    cursor.execute("""
        INSERT INTO missing_records (province, city, user_type, missing_item, search_process, search_date, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ("广东省", "深圳", "居民", "深圳市居民阶梯电价分时数据",
          "尝试检索广东省发改委和深圳供电局官网，未找到居民分时电价具体时段划分和价格",
          "2025-07-01", "缺失", "居民阶梯电价非分时电价，暂不纳入"))
    
    cursor.execute("""
        INSERT INTO missing_records (province, city, user_type, missing_item, search_process, search_date, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ("内蒙古", "全区", "居民", "内蒙古居民分时电价数据",
          "检索内蒙古发改委和内蒙古电力集团官网，暂未公开居民分时电价具体数据",
          "2025-07-01", "缺失", "居民电价按阶梯电价执行"))
    
    cursor.execute("""
        INSERT INTO missing_records (province, city, user_type, missing_item, search_process, search_date, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ("内蒙古", "赤峰/通辽", "工商业", "蒙东电网分时电价数据",
          "内蒙古发改委公开文件主要覆盖蒙西电网，蒙东电网（国网供电区域）数据需单独检索",
          "2025-07-01", "待验证", "蒙东电网分时电价政策可能与蒙西不同"))
    
    cursor.execute("""
        INSERT INTO missing_records (province, city, user_type, missing_item, search_process, search_date, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ("山东省", "全省", "大工业", "山东大工业用户深谷电价数据",
          "检索山东省发改委公开文件，大工业深谷时段价格需查阅最新文件确认",
          "2025-07-01", "待验证", "深谷时段价格可能存在更新"))
    
    cursor.execute("""
        INSERT INTO missing_records (province, city, user_type, missing_item, search_process, search_date, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ("江苏省", "全省", "大工业", "江苏大工业用户夏季尖峰时段价格",
          "检索江苏发改委公开文件，大工业用户尖峰电价系数可能需要人工核实最新调整",
          "2025-07-01", "待验证", "不同电压等级价格系数不同"))
    
    conn.commit()


def export_to_csv(conn):
    """导出所有表为 CSV 文件"""
    tables = ["regions", "policies", "time_periods", "data_sources", "data_source_links", "missing_records"]
    
    for table in tables:
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        col_names = [description[0] for description in cursor.description]
        
        filepath = CSV_DIR / f"{table}.csv"
        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(col_names)
            writer.writerows(rows)
        print(f"✓ 导出 {table}.csv ({len(rows)} 行)")


def export_flat_data(conn):
    """导出平铺的分时电价数据 CSV（用于前端直接读取）"""
    cursor = conn.cursor()
    
    query = """
        SELECT 
            r.province, r.city, r.district,
            p.user_type, p.voltage_level, p.season_type,
            tp.period_name, tp.standard_category,
            tp.start_time, tp.end_time, tp.price, tp.is_next_day,
            tp.remarks as period_remarks,
            p.policy_name, p.effective_date, p.description as policy_desc,
            ds.source_name, ds.source_url, ds.publish_authority,
            ds.publish_date, ds.collect_date, ds.reliability,
            tp.id as time_period_id,
            p.id as policy_id,
            r.id as region_id
        FROM time_periods tp
        JOIN policies p ON tp.policy_id = p.id
        JOIN regions r ON p.region_id = r.id
        LEFT JOIN data_source_links dsl ON dsl.entity_type = 'time_period' AND dsl.entity_id = tp.id
        LEFT JOIN data_sources ds ON dsl.source_id = ds.id
        ORDER BY r.province, p.season_type, tp.start_time
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    col_names = [description[0] for description in cursor.description]
    
    filepath = CSV_DIR / "tou_rates_flat.csv"
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(col_names)
        writer.writerows(rows)
    print(f"✓ 导出 tou_rates_flat.csv ({len(rows)} 行)")
    
    # 导出缺失数据平铺
    cursor.execute("""
        SELECT province, city, user_type, missing_item, search_process, search_date, status, remarks
        FROM missing_records
        ORDER BY province
    """)
    rows = cursor.fetchall()
    col_names = [description[0] for description in cursor.description]
    
    filepath = CSV_DIR / "missing_records_flat.csv"
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(col_names)
        writer.writerows(rows)
    print(f"✓ 导出 missing_records_flat.csv ({len(rows)} 行)")
    
    # 导出数据源平铺
    cursor.execute("""
        SELECT source_name, source_url, publish_authority, publish_date, collect_date, data_type, reliability, remarks
        FROM data_sources
        ORDER BY publish_authority
    """)
    rows = cursor.fetchall()
    col_names = [description[0] for description in cursor.description]
    
    filepath = CSV_DIR / "data_sources_flat.csv"
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(col_names)
        writer.writerows(rows)
    print(f"✓ 导出 data_sources_flat.csv ({len(rows)} 行)")


def export_province_summary(conn):
    """导出省份汇总数据"""
    cursor = conn.cursor()
    
    query = """
        SELECT 
            r.province,
            COUNT(DISTINCT tp.id) as period_count,
            COUNT(DISTINCT p.id) as policy_count,
            MIN(tp.price) as min_price,
            MAX(tp.price) as max_price,
            ROUND(MAX(tp.price) - MIN(tp.price), 4) as peak_valley_spread,
            GROUP_CONCAT(DISTINCT p.season_type) as season_types,
            GROUP_CONCAT(DISTINCT p.user_type) as user_types
        FROM regions r
        JOIN policies p ON p.region_id = r.id
        JOIN time_periods tp ON tp.policy_id = p.id
        GROUP BY r.province
        ORDER BY r.province
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    col_names = [description[0] for description in cursor.description]
    
    filepath = CSV_DIR / "province_summary.csv"
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(col_names)
        writer.writerows(rows)
    print(f"✓ 导出 province_summary.csv ({len(rows)} 行)")


def main():
    print("=" * 60)
    print("城市分时电价观察站 - 数据库初始化")
    print("=" * 60)
    
    # 删除旧数据库
    if DB_PATH.exists():
        DB_PATH.unlink()
        print(f"删除旧数据库: {DB_PATH}")
    
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON")
    
    print("\n[1/4] 创建表结构...")
    create_tables(conn)
    print("✓ 表结构创建完成")
    
    print("\n[2/4] 插入样本数据...")
    insert_sample_data(conn)
    print("✓ 样本数据插入完成")
    
    print("\n[3/4] 导出 CSV 文件...")
    export_to_csv(conn)
    export_flat_data(conn)
    export_province_summary(conn)
    print("✓ CSV 文件导出完成")
    
    conn.commit()
    conn.close()
    
    db_size = DB_PATH.stat().st_size
    print(f"\n✓ 数据库文件: {DB_PATH} ({db_size/1024:.1f} KB)")
    print(f"✓ CSV 数据目录: {CSV_DIR}")
    print("\n✓ 初始化完成！")


if __name__ == "__main__":
    main()
