/**
 * 城市分时电价观察站 - 主应用逻辑
 */

const App = {
    provinces: [],
    sources: [],
    prices: [],
    missing: [],
    currentProvince: '',
    currentSeason: '',
    currentUserType: '',
    chart: null,
    
    // 初始化
    async init() {
        await DataManager.init();
        
        // 显示当前数据源模式
        const modeEl = document.getElementById('current-mode-display');
        if (modeEl) modeEl.textContent = DataManager.getMode().toUpperCase();
        
        // 加载所有数据
        try {
            this.provinces = await DataManager.getProvinces();
            this.sources = await DataManager.getSources();
            this.prices = await DataManager.getPricePolicies();
            this.missing = await DataManager.getMissingData();
            
            this.renderHome();
            this.renderQueryPage();
            this.renderSourcesPage();
            this.renderMissingPage();
            this.renderMethodPage();
            
            console.log('[App] 数据加载完成', {
                provinces: this.provinces.length,
                sources: this.sources.length,
                prices: this.prices.length,
                missing: this.missing.length
            });
        } catch (e) {
            console.error('[App] 数据加载失败', e);
            this.showToast('数据加载失败: ' + e.message);
        }
    },
    
    // 页面切换
    showPage(pageName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const page = document.getElementById('page-' + pageName);
        if (page) page.classList.add('active');
        
        document.querySelectorAll('.navbar-links a').forEach(a => a.classList.remove('active'));
        const nav = document.querySelector(`.navbar-links a[data-page="${pageName}"]`);
        if (nav) nav.classList.add('active');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // 如果切换到首页，重绘图表
        if (pageName === 'home' && this.chart) {
            setTimeout(() => this.renderComparisonChart(), 100);
        }
    },
    
    // 渲染首页
    renderHome() {
        // 统计数据
        const provinceCount = this.provinces.length;
        const sourceCount = this.sources.length;
        const policyCount = this.prices.length;
        const missingCount = this.missing.length;
        const lastUpdate = this.sources.length > 0 
            ? this.sources.reduce((latest, s) => 
                s.collect_date > latest ? s.collect_date : latest, '2026-07-25')
            : '2026-07-25';
        
        document.getElementById('stat-provinces').textContent = provinceCount;
        document.getElementById('stat-sources').textContent = sourceCount;
        document.getElementById('stat-policies').textContent = policyCount;
        document.getElementById('stat-missing').textContent = missingCount;
        document.getElementById('last-update').textContent = lastUpdate;
        
        // 渲染对比表
        this.renderComparisonTable();
        
        // 渲染图表
        setTimeout(() => this.renderComparisonChart(), 100);
    },
    
    // 渲染首页对比表
    renderComparisonTable() {
        const tbody = document.getElementById('comparison-tbody');
        if (!tbody) return;
        
        const categoryMap = {
            '尖峰': { key: 'sharp_peak', class: 'price-sharp-peak' },
            '峰': { key: 'peak', class: 'price-peak' },
            '平': { key: 'flat', class: 'price-flat' },
            '谷': { key: 'valley', class: 'price-valley' },
            '深谷': { key: 'deep_valley', class: 'price-deep-valley' }
        };
        
        let html = '';
        
        this.provinces.forEach(province => {
            const provincePrices = this.prices.filter(p => 
                p.province_id === String(province.id) || p.province_id === province.id
            );
            
            // 获取各类别的代表性电价
            const categories = {};
            provincePrices.forEach(p => {
                const cat = p.standard_category ? (p.standard_category + '').trim() : '';
                if (!cat) return;
                if (!categories[cat]) {
                    let rawPrice = p.price_yuan_kwh;
                    // 统一处理为数字或null
                    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
                        const strPrice = (typeof rawPrice === 'string') ? rawPrice.trim() : String(rawPrice);
                        const numPrice = parseFloat(strPrice);
                        categories[cat] = {
                            price: (!isNaN(numPrice) && numPrice !== 0) ? numPrice : null,
                            basis: p.price_basis ? (p.price_basis + '').trim() : '',
                            time: `${p.start_time || ''}-${p.end_time || ''}`
                        };
                    } else {
                        categories[cat] = {
                            price: null,
                            basis: p.price_basis ? (p.price_basis + '').trim() : '',
                            time: `${p.start_time || ''}-${p.end_time || ''}`
                        };
                    }
                }
            });
            
            // 计算峰谷价差
            let peakValleyDiff = '不适用';
            const peakPrice = categories['峰']?.price || categories['尖峰']?.price;
            const valleyPrice = categories['谷']?.price || categories['深谷']?.price;
            if (peakPrice && valleyPrice) {
                peakValleyDiff = (peakPrice - valleyPrice).toFixed(2);
            } else if ((categories['峰']?.price || categories['尖峰']?.price) && (categories['谷']?.price || categories['深谷']?.price)) {
                // 有价格但某个是 null 的情况已在上面处理，这里保留兜底
                peakValleyDiff = '见浮动比例';
            } else if (categories['峰']?.basis && categories['谷']?.basis) {
                peakValleyDiff = '见浮动比例';
            }
            
            // 判断数据状态
            const hasRealData = provincePrices.length > 0;
            const statusBadge = hasRealData 
                ? '<span class="badge badge-real">真实数据</span>'
                : '<span class="badge badge-missing">暂无数据</span>';
            
            html += `<tr>
                <td class="province-name">${province.province_name}</td>`;
            
            // 尖峰
            if (categories['尖峰']) {
                const p = categories['尖峰'];
                const priceVal = (p.price !== null && p.price !== undefined && !isNaN(p.price)) ? p.price.toFixed(2) : '浮动';
                html += `<td class="price-cell price-sharp-peak">${priceVal}</td>`;
            } else {
                html += `<td><span class="badge badge-na">不适用</span></td>`;
            }
            
            // 峰
            if (categories['峰']) {
                const p = categories['峰'];
                const priceVal = (p.price !== null && p.price !== undefined && !isNaN(p.price)) ? p.price.toFixed(2) : '浮动';
                html += `<td class="price-cell price-peak">${priceVal}</td>`;
            } else {
                html += `<td><span class="badge badge-na">不适用</span></td>`;
            }
            
            // 平
            if (categories['平']) {
                const p = categories['平'];
                const priceVal = (p.price !== null && p.price !== undefined && !isNaN(p.price)) ? p.price.toFixed(2) : '基准';
                html += `<td class="price-cell price-flat">${priceVal}</td>`;
            } else {
                html += `<td><span class="badge badge-na">不适用</span></td>`;
            }
            
            // 谷
            if (categories['谷']) {
                const p = categories['谷'];
                const priceVal = (p.price !== null && p.price !== undefined && !isNaN(p.price)) ? p.price.toFixed(2) : '浮动';
                html += `<td class="price-cell price-valley">${priceVal}</td>`;
            } else {
                html += `<td><span class="badge badge-na">不适用</span></td>`;
            }
            
            // 深谷
            if (categories['深谷']) {
                const p = categories['深谷'];
                const priceVal = (p.price !== null && p.price !== undefined && !isNaN(p.price)) ? p.price.toFixed(2) : '浮动';
                html += `<td class="price-cell price-deep-valley">${priceVal}</td>`;
            } else {
                html += `<td><span class="badge badge-na">不适用</span></td>`;
            }
            
            // 峰谷价差
            html += `<td class="price-cell">${peakValleyDiff}</td>`;
            
            // 状态
            html += `<td>${statusBadge}</td>`;
            
            // 来源链接
            const source = this.sources.find(s => s.id === provincePrices[0]?.source_id);
            if (source) {
                html += `<td><a href="${source.source_url}" target="_blank" class="source-link">查看来源</a></td>`;
            } else {
                html += `<td><span class="badge badge-na">无</span></td>`;
            }
            
            html += `</tr>`;
        });
        
        tbody.innerHTML = html;
    },
    
    // 渲染对比图表（5省峰谷对比）
    renderComparisonChart() {
        const canvas = document.getElementById('comparison-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // 准备数据
        const labels = this.provinces.map(p => p.province_name.replace('内蒙古自治区', '内蒙古').replace('（', '(').replace('）', ')'));
        
        const getCategoryPrice = (provinceId, category) => {
            const provincePrices = this.prices.filter(p => 
                (p.province_id === String(provinceId) || p.province_id === provinceId) &&
                (p.standard_category === category || p.standard_category === category + '')
            );
            if (provincePrices.length === 0) return null;
            // 取第一个有有效数字价格的
            const withPrice = provincePrices.find(p => {
                const val = p.price_yuan_kwh;
                return val !== null && val !== undefined && val !== '' && !isNaN(Number(val));
            });
            if (withPrice) return Number(withPrice.price_yuan_kwh);
            return null;
        };
        
        // 山东有具体价格，其他省份用浮动比例换算（以山东平段为参考基准0.71元/kWh）
        const basePrice = 0.71; // 山东平段参考价
        
        const getEstimatedPrice = (provinceId, category) => {
            const real = getCategoryPrice(provinceId, category);
            if (real !== null && !isNaN(real)) return real;
            
            // 根据浮动比例估算
            const province = this.provinces.find(p => String(p.id) === String(provinceId));
            if (!province) return null;
            
            // 广东: 1.7:1:0.38, 尖峰=1.7*1.25=2.125
            if (String(province.id) === '1') {
                const ratios = { '尖峰': 2.125, '峰': 1.7, '平': 1.0, '谷': 0.38, '深谷': null };
                return ratios[category] !== null && ratios[category] !== undefined ? ratios[category] * basePrice : null;
            }
            // 江苏: 尖峰在峰基础上上浮20%
            if (String(province.id) === '2') {
                const ratios = { '尖峰': 1.2, '峰': 1.0, '平': 0.6, '谷': 0.3, '深谷': 0.24 };
                return ratios[category] !== null && ratios[category] !== undefined ? ratios[category] * basePrice : null;
            }
            // 浙江: 2.05:1.85:1:0.4:0.2
            if (String(province.id) === '4') {
                const ratios = { '尖峰': 2.05, '峰': 1.85, '平': 1.0, '谷': 0.4, '深谷': 0.2 };
                return ratios[category] !== null && ratios[category] !== undefined ? ratios[category] * basePrice : null;
            }
            // 内蒙古蒙西大风季: 1.68:1:0.48, 尖峰=1.68*1.2=2.016, 深谷=0.48*0.8=0.384
            if (String(province.id) === '5') {
                const ratios = { '尖峰': 2.016, '峰': 1.68, '平': 1.0, '谷': 0.48, '深谷': 0.384 };
                return ratios[category] !== null && ratios[category] !== undefined ? ratios[category] * basePrice : null;
            }
            // 内蒙古蒙东: 1.68:1:0.48
            if (String(province.id) === '6') {
                const ratios = { '尖峰': 2.016, '峰': 1.68, '平': 1.0, '谷': 0.48, '深谷': 0.384 };
                return ratios[category] !== null && ratios[category] !== undefined ? ratios[category] * basePrice : null;
            }
            return null;
        };
        
        const datasets = [
            {
                label: '尖峰',
                data: this.provinces.map(p => getEstimatedPrice(p.id, '尖峰')),
                backgroundColor: 'rgba(220,38,38,0.7)',
                borderColor: '#DC2626',
                borderWidth: 1
            },
            {
                label: '峰',
                data: this.provinces.map(p => getEstimatedPrice(p.id, '峰')),
                backgroundColor: 'rgba(239,68,68,0.7)',
                borderColor: '#EF4444',
                borderWidth: 1
            },
            {
                label: '平',
                data: this.provinces.map(p => getEstimatedPrice(p.id, '平')),
                backgroundColor: 'rgba(100,116,139,0.7)',
                borderColor: '#64748B',
                borderWidth: 1
            },
            {
                label: '谷',
                data: this.provinces.map(p => getEstimatedPrice(p.id, '谷')),
                backgroundColor: 'rgba(37,99,235,0.7)',
                borderColor: '#2563EB',
                borderWidth: 1
            },
            {
                label: '深谷',
                data: this.provinces.map(p => getEstimatedPrice(p.id, '深谷')),
                backgroundColor: 'rgba(29,78,216,0.7)',
                borderColor: '#1D4ED8',
                borderWidth: 1
            }
        ];
        
        // 销毁旧图表
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: '五省分时电价分类对比（元/kWh）',
                        font: { size: 14, weight: 'bold' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.y;
                                if (val === null) return context.dataset.label + ': 不适用';
                                return context.dataset.label + ': ' + val.toFixed(3) + ' 元/kWh';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: false,
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '电价 (元/kWh)'
                        },
                        ticks: {
                            callback: function(val) { return val.toFixed(2); }
                        }
                    }
                }
            }
        });
    },
    
    // 渲染查询页面
    renderQueryPage() {
        const select = document.getElementById('query-province');
        if (!select) return;
        
        let html = '<option value="">全部省份</option>';
        this.provinces.forEach(p => {
            html += `<option value="${p.id}">${p.province_name}</option>`;
        });
        select.innerHTML = html;
    },
    
    // 查询
    async onQuery() {
        const provinceId = document.getElementById('query-province').value;
        const season = document.getElementById('query-season').value;
        const userType = document.getElementById('query-user-type').value;
        
        const filters = {};
        if (provinceId) filters.provinceId = provinceId;
        if (season) filters.season = season;
        if (userType) filters.userType = userType;
        
        let data;
        if (Object.keys(filters).length === 0) {
            data = this.prices;
        } else {
            data = await DataManager.getPricePolicies(filters);
        }
        
        this.renderQueryResults(data);
    },
    
    // 渲染查询结果
    renderQueryResults(data) {
        const container = document.getElementById('query-results');
        if (!container) return;
        
        if (data.length === 0) {
            container.innerHTML = '<div class="loading">未找到匹配的数据</div>';
            return;
        }
        
        // 按省份分组
        const grouped = {};
        data.forEach(p => {
            const pid = p.province_id;
            if (!grouped[pid]) grouped[pid] = [];
            grouped[pid].push(p);
        });
        
        let html = '<div class="data-grid">';
        
        for (const pid in grouped) {
            const province = this.provinces.find(p => String(p.id) === String(pid));
            if (!province) continue;
            
            const prices = grouped[pid];
            const source = this.sources.find(s => String(s.id) === String(prices[0]?.source_id));
            
            html += `<div class="data-card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${province.province_name}</div>
                        <div class="card-region">${province.region} | ${prices[0]?.user_type || ''}</div>
                    </div>
                    <span class="badge badge-real">${prices[0]?.data_status || '真实数据'}</span>
                </div>
                <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;">
                    ${prices[0]?.season_type || ''}
                </div>
                <ul class="period-list">`;
            
            prices.forEach(p => {
                const tagClass = this.getTagClass(p.standard_category);
                const rawPrice = p.price_yuan_kwh ? (typeof p.price_yuan_kwh === 'string' ? p.price_yuan_kwh.trim() : String(p.price_yuan_kwh)) : '';
                const numPrice = rawPrice ? parseFloat(rawPrice) : NaN;
                const priceText = (!isNaN(numPrice) && numPrice !== 0)
                    ? numPrice.toFixed(2) + ' 元/kWh'
                    : (p.price_basis || '浮动');
                html += `<li class="period-item">
                    <span class="period-tag ${tagClass}">${p.standard_category}</span>
                    <span class="period-time">${p.start_time}-${p.end_time}</span>
                    <span class="period-price">${priceText}</span>
                </li>`;
            });
            
            html += `</ul>`;
            
            if (source) {
                html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
                    <a href="${source.source_url}" target="_blank" class="source-link" style="font-size:0.8rem;">来源: ${source.issuing_authority}</a>
                </div>`;
            }
            
            html += `</div>`;
        }
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    // 渲染数据源页面
    renderSourcesPage() {
        const container = document.getElementById('sources-list');
        if (!container) return;
        
        let html = '';
        this.sources.forEach(s => {
            html += `<div class="source-card">
                <div class="source-header">
                    <div class="source-title">${s.source_name}</div>
                    <span class="badge badge-real">${s.reliability || '高'}</span>
                </div>
                <a href="${s.source_url}" target="_blank" class="source-url">${s.source_url}</a>
                <div class="source-meta">
                    <span>发布机构: ${s.issuing_authority}</span>
                    <span>发布日期: ${s.publish_date || '未标注'}</span>
                    <span>采集日期: ${s.collect_date || '未标注'}</span>
                </div>
                ${s.notes ? `<div style="margin-top:8px;font-size:0.82rem;color:var(--text-secondary);">${s.notes}</div>` : ''}
            </div>`;
        });
        
        container.innerHTML = html;
    },
    
    // 渲染缺失数据页面
    renderMissingPage() {
        const container = document.getElementById('missing-list');
        if (!container) return;
        
        let html = '';
        this.missing.forEach(m => {
            const province = this.provinces.find(p => String(p.id) === String(m.province_id));
            html += `<div class="missing-card">
                <div class="missing-field">${province ? province.province_name : '未知省份'} - ${m.missing_field}</div>
                <div class="missing-reason"><strong>原因:</strong> ${m.reason}</div>
                <div class="missing-reason"><strong>已检索:</strong> ${m.search_effort}</div>
                <div class="missing-next"><strong>下一步:</strong> ${m.next_step}</div>
            </div>`;
        });
        
        container.innerHTML = html;
    },
    
    // 渲染方法说明页面
    renderMethodPage() {
        // 静态内容已在 HTML 中定义，此处可动态补充
    },
    
    // 工具方法
    getTagClass(category) {
        const map = {
            '尖峰': 'tag-sharp-peak',
            '峰': 'tag-peak',
            '平': 'tag-flat',
            '谷': 'tag-valley',
            '深谷': 'tag-deep-valley'
        };
        return map[category] || 'tag-flat';
    },
    
    // Toast 提示
    showToast(message) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
