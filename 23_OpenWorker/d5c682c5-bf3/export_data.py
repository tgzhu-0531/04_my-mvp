"""导出数据库到 JSON 文件"""
import sqlite3, json, os

db_path = r'F:\02_ChatGPT Work\06_XWork\23_OpenWorker\d5c682c5-bf3\data\electricity_prices.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

cities = [dict(r) for r in conn.execute('SELECT * FROM cities ORDER BY region, name')]

prices = [dict(r) for r in conn.execute('''
    SELECT c.name as city_name, c.province, c.region,
           pr.period_name, pr.voltage_level, pr.price_per_kwh,
           pr.effective_date, pr.notes,
           ds.source_name, ds.url as source_url
    FROM price_records pr
    JOIN cities c ON pr.city_id = c.id
    LEFT JOIN data_sources ds ON pr.source_id = ds.id
    ORDER BY c.region, c.name, pr.period_name
''')]

periods_list = []
for c in cities:
    rows = [dict(r) for r in conn.execute('''
        SELECT period_name, season, start_time, end_time
        FROM price_periods WHERE city_id = ? ORDER BY season, start_time
    ''', (c['id'],))]
    if rows:
        periods_list.append({'city': c['name'], 'periods': rows})

trends = [dict(r) for r in conn.execute('''
    SELECT c.name as city_name, t.year, t.peak_price, t.flat_price,
           t.valley_price, t.spike_price
    FROM annual_price_trends t
    JOIN cities c ON t.city_id = c.id
    ORDER BY c.name, t.year
''')]

sources = [dict(r) for r in conn.execute('''
    SELECT ds.*, (SELECT COUNT(*) FROM price_records pr WHERE pr.source_id = ds.id) as used_count
    FROM data_sources ds ORDER BY ds.reliability_score DESC, ds.source_name
''')]

stats = {'city_count': conn.execute('SELECT COUNT(*) as cnt FROM cities').fetchone()['cnt']}
stats['province_count'] = conn.execute('SELECT COUNT(DISTINCT province) as cnt FROM cities').fetchone()['cnt']
stats['record_count'] = conn.execute('SELECT COUNT(*) as cnt FROM price_records').fetchone()['cnt']
stats['source_count'] = conn.execute('SELECT COUNT(*) as cnt FROM data_sources').fetchone()['cnt']

conn.close()

out_dir = r'F:\02_ChatGPT Work\06_XWork\23_OpenWorker\data'
os.makedirs(out_dir, exist_ok=True)

output = {
    'cities': cities,
    'prices': prices,
    'periods': periods_list,
    'trends': trends,
    'sources': sources,
    'stats': stats
}

json_path = os.path.join(out_dir, 'electricity_data.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f'[OK] {len(cities)} cities, {len(prices)} prices, {len(trends)} trends')
print(f'[OK] saved to {json_path}')
print(f'[OK] file size: {os.path.getsize(json_path)/1024:.1f} KB')
