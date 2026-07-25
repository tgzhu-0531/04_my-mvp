// ============================================================
// 城市分时电价观察站 - 数据加载模块
// 支持 CSV 和 SQLite 两种数据源
// CSV 模式: 直接读取 data/csv/ 下的 CSV 文件
// SQLite 模式: 通过 API 从后端服务获取数据
// ============================================================

const DataLoader = {
    // 通用 CSV 读取
    async readCSV(path) {
        const resp = await fetch(path + '?' + Date.now());
        if (!resp.ok) throw new Error(`无法加载 ${path}`);
        const text = await resp.text();
        return this.parseCSV(text);
    },

    // CSV 解析
    parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            // 处理引号包裹的字段
            const values = [];
            let current = '';
            let inQuotes = false;
            for (let ch of line) {
                if (ch === '"') { inQuotes = !inQuotes; continue; }
                if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
                current += ch;
            }
            values.push(current.trim());
            const row = {};
            headers.forEach((h, idx) => {
                row[h] = idx < values.length ? values[idx] : '';
            });
            rows.push(row);
        }
        return rows;
    },

    // 通用 API 请求 (SQLite 模式)
    async apiGet(endpoint) {
        const url = `${AppConfig.apiBaseUrl}${endpoint}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`API 请求失败: ${url}`);
        const json = await resp.json();
        return json.success ? json.data : [];
    },

    // 按数据源模式加载数据
    async loadData(csvPath, apiEndpoint) {
        if (AppConfig.isSQLite()) {
            return await this.apiGet(apiEndpoint);
        } else {
            return await this.readCSV(csvPath);
        }
    },

    // 获取省份列表
    async getRegions() {
        return await this.loadData(
            AppConfig.csvBasePath + 'regions.csv',
            '/regions');
    },

    // 获取数据来源
    async getSources() {
        return await this.loadData(
            AppConfig.csvBasePath + 'data_sources.csv',
            '/sources');
    },

    // 获取电价政策
    async getPolicies(province) {
        let data;
        if (AppConfig.isSQLite()) {
            const params = province ? `?province=${encodeURIComponent(province)}` : '';
            data = await this.apiGet(`/policies${params}`);
        } else {
            data = await this.readCSV(AppConfig.csvBasePath + 'policies.csv');
            if (province) {
                data = data.filter(r => r.province === province || r.region_id === AppConfig.provinceMap[province]);
            }
        }
        return data;
    },

    // 获取分时时段
    async getPeriods(province) {
        let data;
        if (AppConfig.isSQLite()) {
            const params = province ? `?province=${encodeURIComponent(province)}` : '';
            data = await this.apiGet(`/periods${params}`);
        } else {
            data = await this.readCSV(AppConfig.csvBasePath + 'periods.csv');
            if (province) {
                data = data.filter(r => r.region_id === AppConfig.provinceMap[province]);
            }
        }
        return data;
    },

    // 获取缺失记录
    async getMissingRecords(province) {
        let data;
        if (AppConfig.isSQLite()) {
            const params = province ? `?province=${encodeURIComponent(province)}` : '';
            data = await this.apiGet(`/missing${params}`);
        } else {
            data = await this.readCSV(AppConfig.csvBasePath + 'missing_records.csv');
            if (province) {
                data = data.filter(r => r.region_id === AppConfig.provinceMap[province]);
            }
        }
        return data;
    },

    // 获取概览数据
    async getOverview() {
        if (AppConfig.isSQLite()) {
            return await this.apiGet('/overview');
        }
        // CSV 模式: 从各文件汇总
        const [regions, sources, policies, periods, missing] = await Promise.all([
            this.getRegions(), this.getSources(), this.getPolicies(),
            this.getPeriods(), this.getMissingRecords()
        ]);
        const provinces = regions.filter(r => r.region_type === 'province');
        const provinceStats = provinces.map(p => ({
            province: p.province,
            period_count: periods.filter(pe => pe.region_id === p.region_id).length,
            policy_count: policies.filter(po => po.region_id === p.region_id).length
        }));
        // 价格汇总
        const priceSummary = provinces.map(p => {
            const pPeriods = periods.filter(pe => pe.region_id === p.region_id);
            const pPols = policies.filter(po => po.region_id === p.region_id && po.user_type === '工商业');
            const commPeriods = pPeriods.filter(pe => {
                return pPols.some(po => po.policy_id === pe.policy_id);
            });
            return {
                province: p.province,
                sharp_price: this.findMaxPrice(commPeriods, '尖峰'),
                peak_price: this.findMaxPrice(commPeriods, '峰'),
                flat_price: this.findMaxPrice(commPeriods, '平'),
                valley_price: this.findMaxPrice(commPeriods, '谷'),
                deep_valley_price: this.findMaxPrice(commPeriods, '深谷')
            };
        });
        return {
            provinceCount: provinces.length,
            sourceCount: sources.length,
            policyCount: policies.length,
            periodCount: periods.length,
            missingCount: missing.length,
            provinceStats,
            priceSummary
        };
    },

    findMaxPrice(periods, category) {
        const filtered = periods.filter(p => p.std_category === category && p.price);
        if (filtered.length === 0) return null;
        const prices = filtered.map(p => parseFloat(p.price)).filter(p => !isNaN(p));
        return prices.length > 0 ? Math.max(...prices) : null;
    },

    // 获取每日电价曲线数据
    async getDailyCurve(province) {
        if (AppConfig.isSQLite()) {
            const params = province ? `?province=${encodeURIComponent(province)}` : '';
            return await this.apiGet(`/daily-curve${params}`);
        }
        let periods = await this.getPeriods(province);
        // 加载政策，过滤居民时段
        const policies = await this.getPolicies(province);
        const commPolicyIds = policies
            .filter(p => p.user_type === '工商业')
            .map(p => p.policy_id);
        periods = periods.filter(p => commPolicyIds.includes(p.policy_id));
        return periods;
    }
};