/**
 * CSV Data Adapter
 * 从 CSV 文件读取数据的适配器
 */
class CSVAdapter {
    constructor(basePath) {
        this.basePath = basePath || 'data/';
        this.cache = {};
    }

    /**
     * 读取并解析 CSV 文件
     */
    async loadCSV(filename) {
        if (this.cache[filename]) return this.cache[filename];
        
        const url = this.basePath + filename;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load ${url}: ${response.statusText}`);
        
        const text = await response.text();
        const data = this.parseCSV(text);
        this.cache[filename] = data;
        return data;
    }

    /**
     * 解析 CSV 文本为对象数组
     */
    parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        
        const headers = this.parseLine(lines[0]);
        const result = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseLine(line);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            result.push(row);
        }
        
        return result;
    }

    /**
     * 解析一行 CSV（支持引号包裹的字段）
     */
    parseLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    // ----- API 接口 (与 SQLiteAdapter 保持一致) -----

    async getProvinces() {
        return await this.loadCSV('provinces.csv');
    }

    async getTariffTypes(filters = {}) {
        let data = await this.loadCSV('tariff_types.csv');
        if (filters.province_id) data = data.filter(r => r.province_id === filters.province_id);
        if (filters.user_category) data = data.filter(r => r.user_category === filters.user_category);
        return data;
    }

    async getPrices(filters = {}) {
        let data = await this.loadCSV('prices.csv');
        if (filters.province_id) data = data.filter(r => r.province_id === filters.province_id);
        if (filters.type_id) data = data.filter(r => r.type_id === filters.type_id);
        if (filters.season) data = data.filter(r => r.season === filters.season);
        if (filters.standard_category) data = data.filter(r => r.standard_category === filters.standard_category);
        return data;
    }

    async getDataSources(filters = {}) {
        let data = await this.loadCSV('data_sources.csv');
        if (filters.province_id) data = data.filter(r => r.province_id === filters.province_id);
        if (filters.source_type) data = data.filter(r => r.source_type === filters.source_type);
        return data;
    }

    async getAllPrices() {
        return await this.loadCSV('prices.csv');
    }

    async getSummary() {
        const provinces = await this.getProvinces();
        const prices = await this.getAllPrices();
        const sources = await this.getDataSources();
        
        // Per-province counts
        const perProvince = {};
        for (const p of provinces) {
            perProvince[p.province_id] = {
                province_name: p.province_name,
                count: 0
            };
        }
        for (const price of prices) {
            if (perProvince[price.province_id]) {
                perProvince[price.province_id].count++;
            }
        }
        
        // Category distribution
        const categories = {};
        for (const price of prices) {
            categories[price.standard_category] = (categories[price.standard_category] || 0) + 1;
        }
        
        return {
            totalProvinces: provinces.length,
            totalPriceRecords: prices.length,
            totalDataSources: sources.length,
            perProvince: Object.entries(perProvince).map(([id, v]) => ({
                province_id: id,
                province_name: v.province_name,
                count: v.count
            })),
            categoryDistribution: Object.entries(categories).map(([k, v]) => ({
                standard_category: k,
                count: v
            })),
            lastUpdated: '2025-07-01'
        };
    }
}
