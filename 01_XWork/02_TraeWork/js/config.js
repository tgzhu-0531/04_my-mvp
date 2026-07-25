// ============================================================
// 城市分时电价观察站 - 配置加载模块
// 读取 config.json 并根据 dataSource 决定数据加载策略
// ============================================================

const AppConfig = {
    dataSource: 'csv',
    csvBasePath: 'data/csv/',
    apiBaseUrl: 'http://localhost:3456/api',
    provinces: ['广东', '江苏', '山东', '浙江', '内蒙古'],
    provinceMap: {
        '广东': 'GD', '江苏': 'JS', '山东': 'SD', '浙江': 'ZJ', '内蒙古': 'NM'
    },
    provinceColors: {
        '广东': '#DC2626', '江苏': '#2563EB', '山东': '#D97706',
        '浙江': '#059669', '内蒙古': '#7C3AED'
    },
    provinceClasses: {
        '广东': 'gd', '江苏': 'js', '山东': 'sd', '浙江': 'zj', '内蒙古': 'nm'
    },
    categoryColors: {
        '尖峰': '#DC2626', '峰': '#F97316', '平': '#3B82F6',
        '谷': '#10B981', '深谷': '#059669'
    },
    initialized: false,

    // 加载配置
    async load() {
        try {
            const resp = await fetch('config.json?' + Date.now());
            if (!resp.ok) throw new Error('无法加载 config.json');
            const config = await resp.json();
            this.dataSource = config.dataSource || 'csv';
            this.csvBasePath = config.dataSourceOptions?.csv?.basePath || 'data/csv/';
            this.apiBaseUrl = config.dataSourceOptions?.sqlite?.apiBaseUrl || 'http://localhost:3456/api';
            this.provinces = config.provinces || this.provinces;
            this.initialized = true;
            console.log(`[配置] 数据源模式: ${this.dataSource}`);
            return true;
        } catch (e) {
            console.warn('[配置] 加载失败，使用默认配置:', e.message);
            this.initialized = true;
            return false;
        }
    },

    // 获取数据源显示
    getSourceLabel() {
        return this.dataSource === 'sqlite' ? 'SQLite 数据库' : 'CSV 文件';
    },

    // 获取数据源模式
    getMode() {
        return this.dataSource;
    },

    // 是否为 CSV 模式
    isCSV() {
        return this.dataSource === 'csv';
    },

    // 是否为 SQLite 模式
    isSQLite() {
        return this.dataSource === 'sqlite';
    }
};