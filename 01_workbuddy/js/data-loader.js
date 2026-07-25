/**
 * data-loader.js — 数据访问层
 * 支持 csv 和 api 两种数据源模式
 * csv: 直接 fetch CSV 文件
 * api: 调用本地 Flask API (SQLite 模式)
 */

const DataLoader = (() => {
    'use strict';

    let config = null;
    let mode = 'csv';

    async function loadConfig() {
        if (config) return config;
        const resp = await fetch('config.json');
        config = await resp.json();
        mode = config.selected || 'csv';
        return config;
    }

    async function getMode() {
        if (!config) await loadConfig();
        return mode;
    }

    /* ---------- CSV 模式 ---------- */
    async function fetchCSV(fileName) {
        const cfg = await loadConfig();
        const path = cfg.csv.dataDir + fileName;
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(`CSV 文件加载失败: ${path}`);
        const text = await resp.text();
        return parseCSV(text);
    }

    function parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim());
            if (vals.length === 1 && vals[0] === '') continue;
            const row = {};
            headers.forEach((h, idx) => { row[h] = vals[idx] || null; });
            rows.push(row);
        }
        return rows;
    }

    /* ---------- API 模式 ---------- */
    let apiBase = 'http://localhost:5000/api';

    async function initAPI() {
        const cfg = await loadConfig();
        apiBase = (cfg.sqlite && cfg.sqlite.apiBaseUrl) || apiBase;
    }

    async function fetchAPI(endpoint) {
        await initAPI();
        const resp = await fetch(apiBase + endpoint);
        if (!resp.ok) throw new Error(`API 请求失败: ${endpoint}`);
        return resp.json();
    }

    /* ---------- 查询方法 ---------- */
    function filterRows(rows, conditions) {
        return rows.filter(row => {
            for (const [key, val] of Object.entries(conditions)) {
                if (val === null || val === undefined) continue;
                if ((row[key] || '').toString() !== String(val)) return false;
            }
            return true;
        });
    }

    async function getProvinces() {
        if (mode === 'api') return fetchAPI('/provinces');
        return fetchCSV('regions.csv').then(rows => filterRows(rows, { level: '1' }));
    }

    async function getProvinceById(id) {
        if (mode === 'api') return fetchAPI(`/provinces/${id}`);
        const rows = await fetchCSV('regions.csv');
        return filterRows(rows, { id: String(id) });
    }

    async function getPoliciesByRegion(regionId) {
        if (mode === 'api') return fetchAPI(`/policies?region_id=${regionId}`);
        const policies = await fetchCSV('policies.csv');
        const sources = await fetchCSV('data_sources.csv');
        const matched = filterRows(policies, { region_id: String(regionId) });
        return matched.map(p => {
            const src = sources.find(s => s.id === p.source_id);
            return { ...p, source_name: src?.source_name, source_url: src?.source_url, publish_authority: src?.publish_authority };
        });
    }

    async function getTimePeriods(regionId) {
        if (mode === 'api') return fetchAPI(`/periods?region_id=${regionId}`);
        const rows = await fetchCSV('time_periods.csv');
        const regions = await fetchCSV('regions.csv');
        const matched = filterRows(rows, { region_id: String(regionId) });
        const region = regions.find(r => r.id === String(regionId));
        return matched.map(r => ({ ...r, region_name: region?.name || '' }));
    }

    async function getDataSources() {
        if (mode === 'api') return fetchAPI('/sources');
        return fetchCSV('data_sources.csv');
    }

    async function getMissingRecords() {
        if (mode === 'api') return fetchAPI('/missing');
        return fetchCSV('missing_records.csv');
    }

    async function getStats() {
        if (mode === 'api') return fetchAPI('/stats');
        const provinces = await fetchCSV('regions.csv');
        const policies = await fetchCSV('policies.csv');
        const periods = await fetchCSV('time_periods.csv');
        const sources = await fetchCSV('data_sources.csv');
        return {
            province_count: filterRows(provinces, { level: '1' }).length,
            policy_count: policies.length,
            period_count: periods.length,
            source_count: sources.length,
        };
    }

    /* ---------- 首页对比数据 ---------- */
    async function getComparisonData() {
        /* 返回每个省份的标准分类电价对比 */
        const regions = await fetchCSV('regions.csv');
        const provinces = filterRows(regions, { level: '1' });
        const allPolicies = await fetchCSV('policies.csv');
        const allPeriods = await fetchCSV('time_periods.csv');
        const sources = await fetchCSV('data_sources.csv');

        // 首选季节定义（每省用一个典型季节做对比）
        const preferredSeason = {
            '1': '全年',        // 广东
            '2': '夏冬季',      // 江苏
            '3': '1-2月/12月',  // 山东
            '4': '夏冬季',      // 浙江
            '5': '大风季(1-5月,9-12月)',  // 内蒙古
        };

        const categoryOrder = ['尖峰', '高峰', '平段', '低谷', '深谷'];
        const result = [];

        for (const p of provinces) {
            const rid = p.id;
            const season = preferredSeason[rid];
            const policies = filterRows(allPolicies, { region_id: rid });
            const periods = allPeriods.filter(tp => {
                return tp.region_id === rid && (!season || tp.season_type === season);
            });

            // 找 flat_price
            let flatPrice = null;
            for (const pol of policies) {
                if (pol.flat_price) { flatPrice = parseFloat(pol.flat_price); break; }
            }

            // 按标准分类提取价格
            const prices = {};
            for (const cat of categoryOrder) {
                const catPeriods = periods.filter(tp => tp.standard_category === cat);
                let priceVal = null;
                for (const cp of catPeriods) {
                    if (cp.price && parseFloat(cp.price) > 0) {
                        priceVal = parseFloat(cp.price);
                        break;
                    }
                }
                // 如果没直接价格，用浮动比例计算
                if (priceVal === null && flatPrice !== null) {
                    for (const cp of catPeriods) {
                        if (cp.float_ratio) {
                            priceVal = Math.round(flatPrice * parseFloat(cp.float_ratio) * 10000) / 10000;
                            break;
                        }
                    }
                }
                prices[cat] = priceVal;
            }

            // 峰谷价差（高峰/低谷）
            let pvRatio = null;
            if (prices['高峰'] && prices['低谷']) {
                pvRatio = Math.round(prices['高峰'] / prices['低谷'] * 10) / 10;
            } else if (prices['尖峰'] && prices['低谷']) {
                pvRatio = Math.round(prices['尖峰'] / prices['低谷'] * 10) / 10;
            }

            // 数据状态：检查该省所有 period 的 data_type
            const dataTypes = new Set(periods.map(tp => tp.data_type));
            const dataStatus = dataTypes.has('sample') ? '含示例数据' : '全部真实';

            // 来源
            const sourceIds = new Set(policies.map(pol => pol.source_id));
            const sourceNames = sources.filter(s => sourceIds.has(s.id)).map(s => s.source_name);

            result.push({
                id: rid,
                name: p.name,
                prices,
                pvRatio,
                dataStatus,
                sourceNames,
                season,
                sourceCount: sourceNames.length,
            });
        }

        return result;
    }

    return {
        loadConfig, getMode,
        getProvinces, getProvinceById, getPoliciesByRegion, getTimePeriods,
        getDataSources, getMissingRecords, getStats, getComparisonData,
        fetchCSV, parseCSV, filterRows,
    };
})();
