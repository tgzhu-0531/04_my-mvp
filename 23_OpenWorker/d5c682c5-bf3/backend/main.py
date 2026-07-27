"""
城市分时电价观察站 - FastAPI后端服务
"""
import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

# 确保backend目录在路径中
sys.path.insert(0, os.path.dirname(__file__))

from database import get_connection, init_database, DB_PATH
from seed_data import seed_data


@asynccontextmanager
async def lifespan(app):
    """应用生命周期管理"""
    if not os.path.exists(os.path.dirname(DB_PATH)):
        os.makedirs(os.path.dirname(DB_PATH))
    init_database()
    seed_data()
    print("[OK] 服务启动完成")
    yield


app = FastAPI(
    title="城市分时电价观察站 API",
    description="查询中国各城市分时电价数据，追溯数据来源",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== API 路由 ====================

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "城市分时电价观察站"}


@app.get("/api/cities")
def get_cities():
    """获取所有支持的城市列表"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.id, c.name, c.province, c.region, c.grid_company,
               (SELECT COUNT(*) FROM price_records pr WHERE pr.city_id = c.id) as price_count
        FROM cities c
        ORDER BY c.region, c.name
    ''')
    cities = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"cities": cities}


@app.get("/api/cities/{city_id}")
def get_city_detail(city_id: int):
    """获取单个城市详细信息"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM cities WHERE id = ?', (city_id,))
    city = cursor.fetchone()
    if not city:
        conn.close()
        raise HTTPException(status_code=404, detail="城市未找到")
    conn.close()
    return dict(city)


@app.get("/api/price-periods/{city_id}")
def get_price_periods(city_id: int):
    """获取某个城市的分时时段定义"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM price_periods 
        WHERE city_id = ?
        ORDER BY season, 
            CASE period_name 
                WHEN '尖峰' THEN 1 WHEN '高峰' THEN 2 
                WHEN '平段' THEN 3 WHEN '低谷' THEN 4 
            END,
            start_time
    ''', (city_id,))
    periods = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"periods": periods}


@app.get("/api/prices")
def get_prices(
    city_id: int = Query(None, description="城市ID"),
    period: str = Query(None, description="时段名称"),
    voltage: str = Query("1-10kV", description="电压等级"),
    season: str = Query(None, description="季节")
):
    """查询电价数据"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT pr.id, c.name as city_name, c.province, c.region,
               pr.period_name, pr.voltage_level, pr.price_per_kwh,
               pr.effective_date, pr.notes, pr.created_at,
               ds.source_name, ds.url as source_url, ds.reliability_score
        FROM price_records pr
        JOIN cities c ON pr.city_id = c.id
        LEFT JOIN data_sources ds ON pr.source_id = ds.id
        WHERE 1=1
    '''
    params = []
    
    if city_id:
        query += ' AND pr.city_id = ?'
        params.append(city_id)
    if period:
        query += ' AND pr.period_name = ?'
        params.append(period)
    if voltage:
        query += ' AND pr.voltage_level = ?'
        params.append(voltage)
    
    query += ' ORDER BY c.region, c.name, pr.period_name'
    
    cursor.execute(query, params)
    prices = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"prices": prices, "count": len(prices)}


@app.get("/api/prices/compare")
def compare_prices(
    cities: str = Query(..., description="城市ID列表，逗号分隔"),
    period: str = Query(None, description="时段名称")
):
    """比较多个城市电价"""
    city_ids = [int(c.strip()) for c in cities.split(",")]
    conn = get_connection()
    cursor = conn.cursor()
    
    placeholders = ",".join("?" * len(city_ids))
    query = f'''
        SELECT c.name as city_name, c.province, c.region,
               pr.period_name, pr.price_per_kwh, pr.voltage_level,
               pr.effective_date, ds.source_name, ds.url as source_url
        FROM price_records pr
        JOIN cities c ON pr.city_id = c.id
        LEFT JOIN data_sources ds ON pr.source_id = ds.id
        WHERE pr.city_id IN ({placeholders})
    '''
    params = list(city_ids)
    
    if period:
        query += ' AND pr.period_name = ?'
        params.append(period)
    
    query += ' ORDER BY c.region, c.name, pr.period_name'
    
    cursor.execute(query, params)
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"comparison": results, "count": len(results)}


@app.get("/api/trends/{city_id}")
def get_price_trends(city_id: int):
    """获取某城市的年度电价趋势"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT t.year, t.peak_price, t.flat_price, t.valley_price, t.spike_price,
               c.name as city_name, ds.source_name
        FROM annual_price_trends t
        JOIN cities c ON t.city_id = c.id
        LEFT JOIN data_sources ds ON t.source_id = ds.id
        WHERE t.city_id = ?
        ORDER BY t.year
    ''', (city_id,))
    trends = [dict(row) for row in cursor.fetchall()]
    conn.close()
    if not trends:
        raise HTTPException(status_code=404, detail="未找到该城市的趋势数据")
    return {"trends": trends}


@app.get("/api/sources")
def get_data_sources():
    """获取所有数据来源"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT ds.*, 
               (SELECT COUNT(*) FROM price_records pr WHERE pr.source_id = ds.id) as used_count
        FROM data_sources ds
        ORDER BY ds.reliability_score DESC, ds.source_name
    ''')
    sources = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"sources": sources}


@app.get("/api/stats")
def get_statistics():
    """获取统计概览数据"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) as cnt FROM cities')
    city_count = cursor.fetchone()["cnt"]
    
    cursor.execute('SELECT COUNT(*) as cnt FROM price_records')
    record_count = cursor.fetchone()["cnt"]
    
    cursor.execute('SELECT COUNT(*) as cnt FROM data_sources')
    source_count = cursor.fetchone()["cnt"]
    
    cursor.execute('SELECT COUNT(DISTINCT province) as cnt FROM cities')
    province_count = cursor.fetchone()["cnt"]
    
    cursor.execute('''
        SELECT region, COUNT(*) as cnt 
        FROM cities 
        GROUP BY region 
        ORDER BY cnt DESC
    ''')
    regions = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute('''
        SELECT c.name, pr.period_name, pr.price_per_kwh, c.region
        FROM price_records pr
        JOIN cities c ON pr.city_id = c.id
        WHERE pr.period_name = '高峰'
        ORDER BY pr.price_per_kwh DESC
        LIMIT 1
    ''')
    row = cursor.fetchone()
    highest = dict(row) if row else None
    
    cursor.execute('''
        SELECT c.name, pr.period_name, pr.price_per_kwh, c.region
        FROM price_records pr
        JOIN cities c ON pr.city_id = c.id
        WHERE pr.period_name = '低谷'
        ORDER BY pr.price_per_kwh ASC
        LIMIT 1
    ''')
    row = cursor.fetchone()
    lowest = dict(row) if row else None
    
    conn.close()
    
    return {
        "city_count": city_count,
        "record_count": record_count,
        "source_count": source_count,
        "province_count": province_count,
        "regions": regions,
        "highest_peak": highest,
        "lowest_valley": lowest
    }


# ==================== 前端静态文件 ====================
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="frontend")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))


# ==================== 启动 ====================
if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    print("=" * 50)
    print(" [城市分时电价观察站 - MVP]")
    print(" http://127.0.0.1:8090")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8090)
