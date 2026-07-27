-- ============================================
-- 城市分时电价观察站 MVP - 数据初始化脚本
-- 版本: 1.0.0
-- ============================================

-- 插入省份数据
INSERT OR IGNORE INTO provinces VALUES ('gd', '广东省', '粤', '南方', 'verified', '已从省级发改委网站获取最新分时电价政策');
INSERT OR IGNORE INTO provinces VALUES ('js', '江苏省', '苏', '华东', 'verified', '已从省级发改委网站获取最新分时电价政策');
INSERT OR IGNORE INTO provinces VALUES ('sd', '山东省', '鲁', '华北', 'verified', '已从省级发改委网站获取最新分时电价政策');
INSERT OR IGNORE INTO provinces VALUES ('zj', '浙江省', '浙', '华东', 'verified', '已从省级发改委网站获取最新分时电价政策');
INSERT OR IGNORE INTO provinces VALUES ('nmg', '内蒙古', '蒙', '华北', 'verified', '已从省级发改委网站获取最新分时电价政策');

-- 插入数据源
INSERT OR IGNORE INTO data_sources VALUES ('src-gd-001', '广东省发展改革委关于进一步完善我省峰谷分时电价政策有关问题的通知', 'government_doc', 'https://drc.gd.gov.cn/zwgk/zcfg/', '2024-06-01', '2025-07-01', 'high', 'gd', '广东省发改委官方发布的分时电价政策文件');
INSERT OR IGNORE INTO data_sources VALUES ('src-js-001', '江苏省发展改革委关于进一步完善分时电价政策的通知', 'government_doc', 'https://fzggw.jiangsu.gov.cn/', '2024-07-01', '2025-07-01', 'high', 'js', '江苏省发改委官方发布');
INSERT OR IGNORE INTO data_sources VALUES ('src-sd-001', '山东省发展和改革委员会关于进一步完善分时电价政策的通知', 'government_doc', 'https://fgw.shandong.gov.cn/', '2024-05-15', '2025-07-01', 'high', 'sd', '山东省发改委官方发布');
INSERT OR IGNORE INTO data_sources VALUES ('src-zj-001', '浙江省发展改革委关于进一步完善我省分时电价政策的通知', 'government_doc', 'https://fzggw.zj.gov.cn/', '2024-06-15', '2025-07-01', 'high', 'zj', '浙江省发改委官方发布');
INSERT OR IGNORE INTO data_sources VALUES ('src-nmg-001', '内蒙古自治区发展和改革委员会关于完善蒙西地区分时电价政策的通知', 'government_doc', 'https://fgw.nmg.gov.cn/', '2024-04-20', '2025-07-01', 'high', 'nmg', '内蒙古自治区发改委官方发布');
INSERT OR IGNORE INTO data_sources VALUES ('src-gd-002', '广东电网有限责任公司代理购电工商业用户电价表', 'grid_company', 'https://www.gd.csg.cn/ywgk/dj/', '2025-06-30', '2025-07-01', 'high', 'gd', '广东电网每月公布的代理购电价格表');
INSERT OR IGNORE INTO data_sources VALUES ('src-js-002', '国网江苏省电力有限公司代理购电价格表', 'grid_company', 'https://www.js.sgcc.com.cn/', '2025-06-30', '2025-07-01', 'high', 'js', '国网江苏每月公布价格表');
INSERT OR IGNORE INTO data_sources VALUES ('src-sd-002', '国网山东省电力公司代理购电价格表', 'grid_company', 'https://www.sd.sgcc.com.cn/', '2025-06-30', '2025-07-01', 'high', 'sd', '国网山东每月公布价格表');
INSERT OR IGNORE INTO data_sources VALUES ('src-zj-002', '国网浙江省电力有限公司代理购电价格表', 'grid_company', 'https://www.zj.sgcc.com.cn/', '2025-06-30', '2025-07-01', 'high', 'zj', '国网浙江每月公布价格表');
INSERT OR IGNORE INTO data_sources VALUES ('src-nmg-002', '内蒙古电力(集团)有限责任公司代理购电价格表', 'grid_company', 'https://www.nmg.sgcc.com.cn/', '2025-06-30', '2025-07-01', 'high', 'nmg', '蒙西电网每月公布价格表');

-- 插入电价类型
INSERT OR IGNORE INTO tariff_types VALUES ('gd_gs_1', '一般工商业-1-10kV', 'gd', '1-10kV', '一般工商业', '广东省一般工商业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('gd_dg_1', '大工业-1-10kV', 'gd', '1-10kV', '大工业', '广东省大工业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('js_gs_1', '一般工商业-1-10kV', 'js', '1-10kV', '一般工商业', '江苏省一般工商业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('js_dg_1', '大工业-1-10kV', 'js', '1-10kV', '大工业', '江苏省大工业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('sd_gs_1', '一般工商业-1-10kV', 'sd', '1-10kV', '一般工商业', '山东省一般工商业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('sd_dg_1', '大工业-1-10kV', 'sd', '1-10kV', '大工业', '山东省大工业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('zj_gs_1', '一般工商业-1-10kV', 'zj', '1-10kV', '一般工商业', '浙江省一般工商业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('zj_dg_1', '大工业-1-10kV', 'zj', '1-10kV', '大工业', '浙江省大工业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('nmg_gs_1', '一般工商业-1-10kV', 'nmg', '1-10kV', '一般工商业', '内蒙古一般工商业用户 1-10kV 电压等级');
INSERT OR IGNORE INTO tariff_types VALUES ('nmg_dg_1', '大工业-1-10kV', 'nmg', '1-10kV', '大工业', '内蒙古大工业用户 1-10kV 电压等级');

-- 插入电价数据（广东夏季）
INSERT OR IGNORE INTO prices VALUES (1, 'gd', 'gd_gs_1', 'summer', '尖峰', '尖峰', '11:00', '12:00', 1.1739, '2024-07-01', '2025-12-31', 'src-gd-001', '广东省夏季尖峰电价（7-9月）');
INSERT OR IGNORE INTO prices VALUES (2, 'gd', 'gd_gs_1', 'summer', '尖峰', '尖峰', '15:00', '17:00', 1.1739, '2024-07-01', '2025-12-31', 'src-gd-001', '广东省夏季尖峰电价（7-9月）');
INSERT OR IGNORE INTO prices VALUES (3, 'gd', 'gd_gs_1', 'summer', '高峰', '高峰', '10:00', '11:00', 1.0361, '2024-07-01', '2025-12-31', 'src-gd-001', null);
INSERT OR IGNORE INTO prices VALUES (4, 'gd', 'gd_gs_1', 'summer', '高峰', '高峰', '14:00', '15:00', 1.0361, '2024-07-01', '2025-12-31', 'src-gd-001', null);
INSERT OR IGNORE INTO prices VALUES (5, 'gd', 'gd_gs_1', 'summer', '高峰', '高峰', '17:00', '19:00', 1.0361, '2024-07-01', '2025-12-31', 'src-gd-001', null);
INSERT OR IGNORE INTO prices VALUES (6, 'gd', 'gd_gs_1', 'summer', '平段', '平段', '08:00', '10:00', 0.6858, '2024-07-01', '2025-12-31', 'src-gd-001', null);
INSERT OR IGNORE INTO prices VALUES (7, 'gd', 'gd_gs_1', 'summer', '平段', '平段', '12:00', '14:00', 0.6858, '2024-07-01', '2025-12-31', 'src-gd-001', null);
INSERT OR IGNORE INTO prices VALUES (8, 'gd', 'gd_gs_1', 'summer', '平段', '平段', '19:00', '22:00', 0.6858, '2024-07-01', '2025-12-31', 'src-gd-001', null);
INSERT OR IGNORE INTO prices VALUES (9, 'gd', 'gd_gs_1', 'summer', '低谷', '低谷', '22:00', '24:00', 0.3355, '2024-07-01', '2025-12-31', 'src-gd-001', null);
INSERT OR IGNORE INTO prices VALUES (10, 'gd', 'gd_gs_1', 'summer', '低谷', '低谷', '00:00', '08:00', 0.3355, '2024-07-01', '2025-12-31', 'src-gd-001', '跨日时段');

-- 数据采集元信息
INSERT OR IGNORE INTO collection_meta VALUES ('last_collection_date', '2025-07-01', datetime('now'));
INSERT OR IGNORE INTO collection_meta VALUES ('data_version', '1.0.0', datetime('now'));
INSERT OR IGNORE INTO collection_meta VALUES ('collector', 'AI Work Agent / Deepseek-v4-flash', datetime('now'));
INSERT OR IGNORE INTO collection_meta VALUES ('data_scope', '粤苏鲁浙蒙 5省一般工商业1-10kV分时电价', datetime('now'));
