/**
 * charts.js — 分时电价曲线图绘制
 */

const PriceCharts = (() => {
    'use strict';

    function build24hCurve(periods, flatPrice) {
        /* 将时段数据转为 24 小时电价序列 */
        const prices = new Array(24).fill(null);

        periods.forEach(p => {
            const startH = parseInt(p.start_time?.split(':')[0] || 0);
            const endH = parseInt(p.end_time?.split(':')[0] || 0);
            let price = parseFloat(p.price);

            if (isNaN(price) && flatPrice && p.float_ratio) {
                price = flatPrice * parseFloat(p.float_ratio);
            }

            if (!isNaN(price)) {
                price = Math.round(price * 10000) / 10000;
                if (endH <= startH) {
                    for (let h = startH; h < 24; h++) prices[h] = price;
                    for (let h = 0; h < endH; h++) prices[h] = price;
                } else {
                    for (let h = startH; h < endH; h++) prices[h] = price;
                }
            }
        });

        return prices;
    }

    function getCategoryColor(cat) {
        const map = { '尖峰': '#DC2626', '高峰': '#EF4444', '平段': '#F59E0B', '低谷': '#3B82F6', '深谷': '#6366F1' };
        return map[cat] || '#A0AEC0';
    }

    function getSegmentColors(prices, periods) {
        /* 为每个时段生成颜色 */
        const colors = new Array(24).fill('#A0AEC0');
        periods.forEach(p => {
            const startH = parseInt(p.start_time?.split(':')[0] || 0);
            const endH = parseInt(p.end_time?.split(':')[0] || 0);
            const color = getCategoryColor(p.standard_category);
            if (endH <= startH) {
                for (let h = startH; h < 24; h++) colors[h] = color;
                for (let h = 0; h < endH; h++) colors[h] = color;
            } else {
                for (let h = startH; h < endH; h++) colors[h] = color;
            }
        });
        return colors;
    }

    function renderCurve(canvasId, labels, priceData, segColors) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const c = ctx.getContext('2d');

        new Chart(c, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '电价 (元/kWh)',
                    data: priceData,
                    borderColor: '#00A7CB',
                    backgroundColor: 'rgba(0, 167, 203, 0.08)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: d => {
                        const v = d.raw;
                        return v === null || isNaN(v) ? 'transparent' : getCategoryColor(findCategory(d.dataIndex, segColors));
                    },
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    tension: 0,
                    fill: true,
                    segment: {
                        borderColor: ctx2 => {
                            const idx = ctx2.p0DataIndex;
                            return segColors[idx] || '#A0AEC0';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const val = ctx.parsed.y;
                                if (val === null || isNaN(val)) return '无数据';
                                return '¥' + val.toFixed(4) + ' 元/kWh';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '电价 (元/kWh)' },
                        ticks: { callback: v => '¥' + v.toFixed(2) }
                    },
                    x: {
                        title: { display: true, text: '时段' },
                        ticks: { maxRotation: 45, maxTicksLimit: 24 }
                    }
                }
            }
        });
    }

    function findCategory(dataIndex, segColors) {
        const c = segColors[dataIndex];
        const map = { '#DC2626': '尖峰', '#EF4444': '高峰', '#F59E0B': '平段', '#3B82F6': '低谷', '#6366F1': '深谷' };
        return map[c] || '';
    }

    function renderMultiCurve(canvasId, labels, allCurves) {
        /* 多省份叠图对比 */
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const c = ctx.getContext('2d');

        const colors = ['#00A7CB', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
        const datasets = allCurves.map((cv, i) => ({
            label: cv.province,
            data: cv.prices,
            borderColor: colors[i % colors.length],
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: colors[i % colors.length],
            tension: 0,
            spanGaps: false,
        }));

        new Chart(c, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 14, padding: 12, font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const val = ctx.parsed.y;
                                if (val === null || isNaN(val)) return ctx.dataset.label + ': 无数据';
                                return ctx.dataset.label + ': ¥' + val.toFixed(4);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '电价 (元/kWh)' },
                        ticks: { callback: v => '¥' + v.toFixed(2) }
                    },
                    x: {
                        title: { display: true, text: '时段' },
                        ticks: { maxRotation: 45, maxTicksLimit: 24 }
                    }
                }
            }
        });
    }

    return { build24hCurve, getCategoryColor, getSegmentColors, renderCurve, renderMultiCurve };
})();
