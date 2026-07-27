/**
 * SQLite Data Adapter
 * 通过后端 API 从 SQLite 数据库读取数据
 */
class SQLiteAdapter {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl || 'http://localhost:8080';
    }

    async fetchAPI(path) {
        const url = this.apiBaseUrl + path;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        return await response.json();
    }

    async getProvinces() {
        const data = await this.fetchAPI('/api/provinces');
        return data.provinces;
    }

    async getTariffTypes(filters = {}) {
        const params = new URLSearchParams();
        if (filters.province_id) params.set('province_id', filters.province_id);
        if (filters.user_category) params.set('user_category', filters.user_category);
        const qs = params.toString();
        const url = '/api/tariff-types' + (qs ? '?' + qs : '');
        const data = await this.fetchAPI(url);
        return data.tariff_types;
    }

    async getPrices(filters = {}) {
        const params = new URLSearchParams();
        if (filters.province_id) params.set('province_id', filters.province_id);
        if (filters.type_id) params.set('type_id', filters.type_id);
        if (filters.season) params.set('season', filters.season);
        if (filters.standard_category) params.set('standard_category', filters.standard_category);
        if (filters.user_category) params.set('user_category', filters.user_category);
        const qs = params.toString();
        const url = '/api/prices' + (qs ? '?' + qs : '');
        const data = await this.fetchAPI(url);
        return data.prices;
    }

    async getDataSources(filters = {}) {
        const params = new URLSearchParams();
        if (filters.province_id) params.set('province_id', filters.province_id);
        if (filters.source_type) params.set('source_type', filters.source_type);
        const qs = params.toString();
        const url = '/api/data-sources' + (qs ? '?' + qs : '');
        const data = await this.fetchAPI(url);
        return data.data_sources;
    }

    async getAllPrices() {
        return await this.getPrices();
    }

    async getSummary() {
        const data = await this.fetchAPI('/api/summary');
        return data;
    }
}
