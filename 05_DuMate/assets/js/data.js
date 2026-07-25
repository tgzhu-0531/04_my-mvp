/**
 * 城市分时电价观察站 - 数据访问层
 * 支持 SQLite（通过本地API）和 CSV（直接读取静态文件）双数据源
 * 通过 config.json 切换，同一套前端代码
 */

const DataManager = {
    config: null,
    dataSource: 'csv',
    sqliteBaseUrl: '',
    
    // 初始化：读取 config.json
    async init() {
        try {
            const response = await fetch('./config.json');
            this.config = await response.json();
            this.dataSource = this.config.dataSource || 'csv';
            if (this.dataSource === 'sqlite') {
                const port = this.config.sqlite?.serverPort || 3000;
                this.sqliteBaseUrl = `http://localhost:${port}`;
            }
            console.log(`[DataManager] 数据源: ${this.dataSource}`);
            return this.config;
        } catch (e) {
            console.warn('[DataManager] 无法读取 config.json，默认使用 CSV 模式', e);
            this.dataSource = 'csv';
            return { dataSource: 'csv' };
        }
    },
    
    // CSV 解析
    parseCSV(text) {
        // 去除可能的 UTF-8 BOM
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substring(1);
        }
        // 统一换行符
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
            console.warn('[DataManager] CSV 只有表头或为空');
            return [];
        }
        
        const headers = this.parseCSVLine(lines[0]).map(h => h.trim());
        console.log(`[DataManager] CSV headers: ${headers.length} fields`);
        
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            // 跳过与表头字段数严重不匹配的行
            if (values.length < headers.length - 2 || values.length > headers.length + 2) {
                console.warn(`[DataManager] 跳过字段数不匹配的行 ${i}: ${values.length} vs ${headers.length}`);
                continue;
            }
            const row = {};
            headers.forEach((h, idx) => {
                let val = values[idx] !== undefined ? values[idx].trim() : '';
                // 数字字段转换
                if (val !== '' && /^-?\d+\.?\d*$/.test(val)) {
                    const num = parseFloat(val);
                    if (!isNaN(num) && isFinite(num)) {
                        val = num;
                    }
                }
                row[h] = val;
            });
            rows.push(row);
        }
        console.log(`[DataManager] Parsed ${rows.length} rows`);
        return rows;
    },
    
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    },
    
    // 获取省份列表
    async getProvinces() {
        if (this.dataSource === 'sqlite') {
            return this.fetchApi('/api/provinces');
        } else {
            const text = await this.fetchCsv('provinces.csv');
            return this.parseCSV(text);
        }
    },
    
    // 获取数据来源
    async getSources() {
        if (this.dataSource === 'sqlite') {
            return this.fetchApi('/api/sources');
        } else {
            const text = await this.fetchCsv('sources.csv');
            return this.parseCSV(text);
        }
    },
    
    // 获取电价政策数据
    async getPricePolicies(filters = {}) {
        if (this.dataSource === 'sqlite') {
            let url = '/api/prices?';
            const params = [];
            if (filters.provinceId) params.push(`province_id=${filters.provinceId}`);
            if (filters.season) params.push(`season=${encodeURIComponent(filters.season)}`);
            if (filters.userType) params.push(`user_type=${encodeURIComponent(filters.userType)}`);
            url += params.join('&');
            return this.fetchApi(url);
        } else {
            const text = await this.fetchCsv('price_policies.csv');
            let rows = this.parseCSV(text);
            // 前端过滤（统一用 String 比较，避免数字/字符串类型不匹配）
            if (filters.provinceId !== undefined && filters.provinceId !== null && filters.provinceId !== '') {
                rows = rows.filter(r => String(r.province_id) === String(filters.provinceId));
            }
            if (filters.season) {
                rows = rows.filter(r => r.season_type && String(r.season_type).includes(String(filters.season)));
            }
            if (filters.userType) {
                rows = rows.filter(r => r.user_type && String(r.user_type).includes(String(filters.userType)));
            }
            return rows;
        }
    },
    
    // 获取缺失数据
    async getMissingData() {
        if (this.dataSource === 'sqlite') {
            return this.fetchApi('/api/missing');
        } else {
            const text = await this.fetchCsv('missing_data.csv');
            return this.parseCSV(text);
        }
    },
    
    // 工具方法：fetch API
    async fetchApi(path) {
        const url = this.sqliteBaseUrl + path;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API 请求失败: ${response.status}`);
        return response.json();
    },
    
    // 工具方法：fetch CSV
    async fetchCsv(filename) {
        let basePath = './data/';
        if (this.config && this.config.csv && this.config.csv.dataPath) {
            basePath = this.config.csv.dataPath;
            if (!basePath.endsWith('/')) basePath += '/';
        }
        const url = basePath + filename;
        console.log(`[DataManager] Fetching CSV: ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${url}`);
            }
            const text = await response.text();
            console.log(`[DataManager] ${filename} loaded: ${text.length} chars, ${text.split('\n').length} lines`);
            return text;
        } catch (e) {
            console.error(`[DataManager] Failed to load ${filename}:`, e);
            throw e;
        }
    },
    
    // 获取当前数据源模式
    getMode() {
        return this.dataSource;
    }
};
