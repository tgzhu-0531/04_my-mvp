-- 种子数据：5省分时电价时段
-- 执行方式：导入到SQLite后使用

-- 先禁用外键约束以保证导入顺序
PRAGMA foreign_keys = OFF;

-- 省份数据
INSERT OR IGNORE INTO provinces (province_id, province_name, province_abbr, region, area_km2, data_status) VALUES
('GD', '广东', '粤', '华南', 179800, 'verified'),
('JS', '江苏', '苏', '华东', 107200, 'verified'),
('SD', '山东', '鲁', '华东', 157900, 'verified'),
('ZJ', '浙江', '浙', '华东', 105500, 'verified'),
('NM', '内蒙古', '蒙', '华北', 1183000, 'verified');

-- 来源数据
INSERT OR IGNORE INTO sources (source_id, province_id, source_name, publisher, doc_number, publish_date, effective_date, source_url, reliability, collect_date) VALUES
('SRC-GD-001','GD','广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知','广东省发展和改革委员会','粤发改价格〔2021〕331号','2021-08-31','2021-10-01','http://drc.gd.gov.cn/gkmlpt/content/3/3466/post_3466564.html','high','2025-12-01'),
('SRC-JS-001','JS','江苏省发展改革委关于进一步完善分时电价机制有关事项的通知','江苏省发展和改革委员会','苏发改价格发〔2022〕228号','2022-03-10','2022-04-01','http://fzggw.jiangsu.gov.cn/art/2022/3/10/art_285_10694217.html','high','2025-12-01'),
('SRC-JS-002','JS','江苏省发展改革委关于进一步完善分时电价政策有关事项的通知','江苏省发展和改革委员会','苏发改价格发〔2024〕23号','2024-01-15','2024-03-01','http://fzggw.jiangsu.gov.cn','high','2025-12-01'),
('SRC-SD-001','SD','关于进一步完善分时电价政策的通知','山东省发展和改革委员会','鲁发改价格〔2022〕18号','2022-01-20','2022-03-01','http://fgw.shandong.gov.cn/art/2022/1/20/art_916_10300251.html','high','2025-12-01'),
('SRC-ZJ-001','ZJ','浙江省发展改革委关于调整我省分时电价政策的通知','浙江省发展和改革委员会','浙发改价格〔2024〕1号','2024-01-05','2024-03-01','http://fzggw.zj.gov.cn/art/2024/1/5/art_1229123297_2488127.html','high','2025-12-01'),
('SRC-NM-001','NM','内蒙古自治区发展改革委关于进一步完善分时电价政策的通知','内蒙古自治区发展和改革委员会','内发改价费字〔2023〕533号','2023-04-20','2023-06-01','http://fgw.nmg.gov.cn/xxgk/zxzx/tzgg/202304/t20230420_2292802.html','high','2025-12-01');

PRAGMA foreign_keys = ON;
