// ============================================================
// 城市分时电价观察站 - 图表绘制模块
// 基于 Chart.js 绘制24小时电价曲线和对比图
// ============================================================

const ChartRenderer = {
    chartInstances: {},

    // 生成24小时价格序列 (0-23点)
    generateHourlyPrices(periods) {
        const hourly = new Array(24).fill(null);
        const categories = new Array(24).fill('');
        const periodNames = new Array(24).fill('');

        periods.forEach(p => {
            const start = this.timeToHour(p.start_time);
            const end = this.timeToHour(p.end_time);
            const price = parseFloat(p.price);
            if (isNaN(price) || start === undefined || end === undefined) return;

            if (start <= end) {
                for (let h = start; h < end; h++) {
                    hourly[h] = price;
                    categories[h] = p.std_category;
                    periodNames[h] = p.original_name;
                }
            } else {
                // 跨夜 (如 21:00 - 08:00)
                for (let h = start; h < 24; h++) {
                    hourly[h] = price;
                    categories[h] = p.std_category;
                    periodNames[h] = p.original_name;
                }
                for (let h = 0; h < end; h++) {
                    hourly[h] = price;
                    categories[h] = p.std_category;
                    periodNames[h] = p.original_name;
                }
            }
        });
        return { hourly, categories, periodNames };
    },

    timeToHour(time) {
        if (!time) return undefined;
        const parts = time.split(':');
        return parseInt(parts[0]);
    },

    // 绘制单省24小时曲线
    drawSingleCurve(canvasId, province, periods, provinceColor) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.chartInstances[canvasId]) {
            this.chartInstances[canvasId].destroy();
        }

        const { hourly, categories } = this.generateHourlyPrices(periods);
        const labels = [];
        for (let h = 0; h < 24; h++) {
            labels.push(`${h.toString().padStart(2, '0')}:00`);
        }

        // 背景色配置
        const bgColors = hourly.map((v, i) => {
            if (v === null) return 'rgba(0,0,0,0)';
            const cat = categories[i] || '';
            switch (cat) {
                case '尖峰': return 'rgba(220,38,38,0.15)';
                case '峰': return 'rgba(249,115,22,0.15)';
                case '平': return 'rgba(59,130,246,0.15)';
                case '谷': return 'rgba(16,185,129,0.15)';
                case '深谷': return 'rgba(5,150,105,0.15)';
                default: return 'rgba(0,0,0,0)';
            }
        });

        const borderColors = hourly.map((v, i) => {
            if (v === null) return 'rgba(0,0,0,0)';
            const cat = categories[i] || '';
            switch (cat) {
                case '尖峰': return '#DC2626';
                case '峰': return '#F97316';
                case '平': return '#3B82F6';
                case '谷': return '#10B981';
                case '深谷': return '#059669';
                default: return provinceColor || '#3B82F6';
            }
        });

        this.chartInstances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `${province} 分时电价`,
                    data: hourly,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 2,
                    barPercentage: 0.9,
                    categoryPercentage: 1.0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                if (val === null) return '无数据';
                                const cat = categories[ctx.dataIndex] || '';
                                return `${province} ${cat} ${val.toFixed(4)} 元/kWh`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '电价 (元/kWh)',
                            font: { size: 12 }
                        },
                        ticks: {
                            callback: (v) => v.toFixed(2) + '元'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '时段 (小时)',
                            font: { size: 12 }
                        },
                        ticks: {
                            maxRotation: 45,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    },

    // 绘制多省叠图对比
    drawMultiCurve(canvasId, allProvincesData, labels) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.chartInstances[canvasId]) {
            this.chartInstances[canvasId].destroy();
        }

        const hourLabels = [];
        for (let h = 0; h < 24; h++) {
            hourLabels.push(`${h.toString().padStart(2, '0')}:00`);
        }

        const datasets = allProvincesData.map(pd => {
            const { hourly } = this.generateHourlyPrices(pd.periods);
            return {
                label: pd.province,
                data: hourly,
                borderColor: pd.color,
                backgroundColor: pd.color + '20',
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.3,
                fill: false
            };
        });

        this.chartInstances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hourLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 16,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                if (val === null) return `${ctx.dataset.label}: 无数据`;
                                return `${ctx.dataset.label}: ${val.toFixed(4)} 元/kWh`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '电价 (元/kWh)',
                            font: { size: 12 }
                        },
                        ticks: {
                            callback: (v) => v.toFixed(2) + '元'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '时段 (小时)',
                            font: { size: 12 }
                        },
                        ticks: {
                            maxRotation: 45,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }
};