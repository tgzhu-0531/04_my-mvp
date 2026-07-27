/* 城市分时电价观察站 - OpenWorker 版 */
const DATA_URL = 'data/electricity_data.json';
var DATA = null;
var peakChart = null, trendChart = null, compareChart = null;

/* ====== 初始化 ====== */
document.addEventListener('DOMContentLoaded', async function(){
    await loadData();
    setupNav();
    renderDashboard();
    setupQueryForm();
    setupPeriodPicker();
    renderCompareCheckboxes();
});

async function loadData(){
    try {
        var r = await fetch(DATA_URL);
        DATA = await r.json();
    } catch(e){
        document.getElementById('statsGrid').innerHTML = '<div class="empty">⚠️ 数据加载失败</div>';
    }
}

/* ====== Tab 导航 ====== */
function setupNav(){
    var items = document.querySelectorAll('.nav-item');
    items.forEach(function(el){
        el.addEventListener('click', function(){
            var tab = this.dataset.tab;
            items.forEach(function(n){ n.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
            document.getElementById('tab-'+tab).classList.add('active');
            if(tab==='dashboard') renderDashboard();
            if(tab==='sources') renderSources();
            if(tab==='compare') doCompare();
        });
    });
}

/* ====== 总览 ====== */
function renderDashboard(){
    if(!DATA) return;
    var s = DATA.stats;
    document.getElementById('statsGrid').innerHTML =
        '<div class="stat-card"><div class="stat-num">'+s.city_count+'</div><div class="stat-label">覆盖城市</div></div>'+
        '<div class="stat-card"><div class="stat-num">'+s.province_count+'</div><div class="stat-label">覆盖省份</div></div>'+
        '<div class="stat-card"><div class="stat-num">'+s.record_count+'</div><div class="stat-label">电价记录</div></div>'+
        '<div class="stat-card"><div class="stat-num">'+s.source_count+'</div><div class="stat-label">数据来源</div></div>';
    
    renderCityGrid();
    renderPeakChart();
    renderTrendSelector();
    renderTrendChart();
    document.getElementById('cityBadge').textContent = DATA.cities.length + ' 个城市';
}

/* ====== 城市网格 ====== */
function renderCityGrid(){
    var g = document.getElementById('cityGrid');
    g.innerHTML = DATA.cities.map(function(c){
        return '<div class="city-card" onclick="goCity('+c.id+',\''+c.name+'\')">'+
            '<div class="cc-name">'+c.name+'</div>'+
            '<div class="cc-prov">'+c.province+' · '+c.region+'</div>'+
            '<div class="cc-grid">'+c.grid_company+'</div></div>';
    }).join('');
}

function goCity(id, name){
    document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelector('.nav-item[data-tab="query"]').classList.add('active');
    document.getElementById('tab-query').classList.add('active');
    document.getElementById('qCity').value = id;
    doQuery();
}

/* ====== 柱状图: 各城市高峰电价 ====== */
function renderPeakChart(){
    var ctx = document.getElementById('chartPeak');
    if(!ctx) return;
    if(peakChart) { peakChart.destroy(); peakChart = null; }
    var items = DATA.prices.filter(function(p){ return p.period_name==='高峰'; });
    var labels = items.map(function(p){ return p.city_name; });
    var vals = items.map(function(p){ return p.price_per_kwh; });
    var colors = vals.map(function(v){ return v>1.0 ? '#EF4444' : v>0.8 ? '#F59E0B' : '#10B981'; });
    peakChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '高峰电价 (元/kWh)',
                data: vals,
                backgroundColor: colors,
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(ctx){ return ctx.parsed.y.toFixed(4)+' 元'; } } }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: '元/kWh', font: { size: 11 } } },
                x: { ticks: { maxRotation: 30, font: { size: 10 } } }
            }
        }
    });
}

/* ====== 趋势 ====== */
function renderTrendSelector(){
    var sel = document.getElementById('trendCity');
    if(!sel) return;
    var names = ['北京','上海','广州'];
    sel.innerHTML = names.map(function(n){
        var c = DATA.cities.find(function(x){ return x.name===n; });
        return c ? '<option value="'+c.id+'">'+n+'</option>' : '';
    }).join('');
    sel.onchange = renderTrendChart;
}

function renderTrendChart(){
    var ctx = document.getElementById('chartTrend');
    if(!ctx) return;
    if(trendChart) { trendChart.destroy(); trendChart = null; }
    var sel = document.getElementById('trendCity');
    if(!sel) return;
    var cityName = sel.options[sel.selectedIndex].text;
    var tds = DATA.trends.filter(function(t){ return t.city_name===cityName; });
    if(!tds.length) return;
    var years = tds.map(function(t){ return t.year; });
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                { label:'尖峰', data: tds.map(function(t){return t.spike_price;}), borderColor:'#DC2626', backgroundColor:'transparent', tension:0.3, pointStyle:'circle' },
                { label:'高峰', data: tds.map(function(t){return t.peak_price;}), borderColor:'#EA580C', backgroundColor:'transparent', tension:0.3, pointStyle:'diamond' },
                { label:'平段', data: tds.map(function(t){return t.flat_price;}), borderColor:'#2563EB', backgroundColor:'transparent', tension:0.3, pointStyle:'triangle' },
                { label:'低谷', data: tds.map(function(t){return t.valley_price;}), borderColor:'#16A34A', backgroundColor:'transparent', tension:0.3, pointStyle:'rect' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position:'bottom', labels:{font:{size:10}} },
                tooltip: { callbacks: { label: function(ctx){ return ctx.dataset.label+': '+ctx.parsed.y.toFixed(4); } } }
            },
            scales: {
                y: { title:{display:true,text:'元/kWh',font:{size:11}} }
            }
        }
    });
}

/* ====== 电价查询 ====== */
function setupQueryForm(){
    var sel = document.getElementById('qCity');
    if(sel && DATA) sel.innerHTML = '<option value="">全部城市</option>' +
        DATA.cities.map(function(c){ return '<option value="'+c.id+'">'+c.name+' ('+c.province+')</option>'; }).join('');
}

function doQuery(){
    var cityId = document.getElementById('qCity').value;
    var period = document.getElementById('qPeriod').value;
    var voltage = document.getElementById('qVoltage').value;
    var list = DATA.prices.filter(function(p){
        if(cityId && p.city_name !== DATA.cities.find(function(c){return c.id==cityId;})?.name) return false;
        if(period && p.period_name !== period) return false;
        if(p.voltage_level !== voltage) return false;
        return true;
    });
    var tbody = document.getElementById('qResult');
    if(!list.length){
        tbody.innerHTML = '<tr><td colspan="8" class="empty">未找到匹配数据</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(function(p){
        return '<tr><td><strong>'+p.city_name+'</strong></td><td>'+p.province+'</td><td>'+p.region+'</td>'+
            '<td><span class="badge">'+p.period_name+'</span></td><td><strong>'+p.price_per_kwh.toFixed(4)+'</strong></td>'+
            '<td>'+p.voltage_level+'</td><td>'+p.effective_date+'</td>'+
            '<td><a href="'+(p.source_url||'#')+'" target="_blank" class="source-link">'+(p.source_name||'—')+'</a></td></tr>';
    }).join('');
}

function resetQuery(){
    document.getElementById('qCity').value = '';
    document.getElementById('qPeriod').value = '';
    document.getElementById('qResult').innerHTML = '<tr><td colspan="8" class="empty">选择条件后点击查询</td></tr>';
}

/* ====== 分时时段 ====== */
function setupPeriodPicker(){
    var sel = document.getElementById('pCity');
    if(!sel || !DATA) return;
    sel.innerHTML = '<option value="">请选择</option>' +
        DATA.cities.map(function(c){ return '<option value="'+c.id+'">'+c.name+'</option>'; }).join('');
    sel.onchange = function(){
        var id = this.value;
        if(!id){ document.getElementById('periodWrap').innerHTML = '<p class="empty">请先选择城市</p>'; return; }
        var name = this.options[this.selectedIndex].text;
        var found = DATA.periods.find(function(p){ return p.city===name; });
        if(!found || !found.periods.length){
            document.getElementById('periodWrap').innerHTML = '<p class="empty">暂无时段定义</p>';
            return;
        }
        var html = '<table><thead><tr><th>时段</th><th>季节</th><th>开始</th><th>结束</th></tr></thead><tbody>';
        found.periods.forEach(function(p){
            html += '<tr><td><span class="badge">'+p.period_name+'</span></td><td>'+p.season+'</td><td>'+p.start_time+'</td><td>'+p.end_time+'</td></tr>';
        });
        html += '</tbody></table>';
        document.getElementById('periodWrap').innerHTML = html;
    };
}

/* ====== 对比 ====== */
function renderCompareCheckboxes(){
    var c = document.getElementById('cbCities');
    if(!c || !DATA) return;
    c.innerHTML = DATA.cities.map(function(city){
        return '<label><input type="checkbox" value="'+city.name+'"><span>'+city.name+'</span></label>';
    }).join('');
}

function doCompare(){
    var checked = document.querySelectorAll('#cbCities input:checked');
    if(checked.length<2){ document.getElementById('compareResult').innerHTML = '<tr><td colspan="6" class="empty">请至少选择2个城市</td></tr>'; return; }
    var names = Array.from(checked).map(function(cb){ return cb.value; });
    // Build city data map
    var map = {};
    DATA.prices.forEach(function(p){
        if(names.indexOf(p.city_name) >= 0){
            if(!map[p.city_name]) map[p.city_name] = {};
            map[p.city_name][p.period_name] = p.price_per_kwh;
        }
    });
    // Compare table
    var tbody = document.getElementById('compareResult');
    tbody.innerHTML = names.map(function(n){
        var d = map[n] || {};
        var pk = d['高峰']||0, vl = d['低谷']||0, sp = d['尖峰']||0, fl = d['平段']||0;
        var diff = pk - vl;
        return '<tr><td><strong>'+n+'</strong></td><td>'+(sp?sp.toFixed(4):'—')+'</td><td>'+(pk?pk.toFixed(4):'—')+'</td>'+
            '<td>'+(fl?fl.toFixed(4):'—')+'</td><td>'+(vl?vl.toFixed(4):'—')+'</td><td><strong>'+(diff>0?diff.toFixed(4):'—')+'</strong></td></tr>';
    }).join('');
    // Compare chart
    renderCompareChart(names, map);
}

function renderCompareChart(names, map){
    var ctx = document.getElementById('chartCompare');
    if(!ctx) return;
    if(compareChart) { compareChart.destroy(); compareChart = null; }
    var periods = ['尖峰','高峰','平段','低谷'];
    var colors = { '尖峰':'#DC2626', '高峰':'#EA580C', '平段':'#2563EB', '低谷':'#16A34A' };
    var datasets = periods.map(function(p){
        return {
            label: p,
            data: names.map(function(n){ return (map[n]&&map[n][p])||0; }),
            backgroundColor: colors[p],
            borderRadius: 3,
            barPercentage: 0.7,
            categoryPercentage: 0.6
        };
    });
    compareChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: names, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position:'bottom', labels:{font:{size:10}} },
                tooltip: { callbacks: { label: function(ctx){ return ctx.dataset.label+': '+ctx.parsed.y.toFixed(4); } } }
            },
            scales: {
                y: { title:{display:true,text:'元/kWh',font:{size:11}} },
                x: { ticks: { font:{size:10} } }
            }
        }
    });
}

/* ====== 来源 ====== */
function renderSources(){
    var tbody = document.getElementById('srcResult');
    if(!tbody || !DATA) return;
    tbody.innerHTML = DATA.sources.map(function(s){
        var dots = '';
        for(var i=0;i<5;i++) dots += '<span class="dot '+(i<s.reliability_score?'on':'off')+'"></span>';
        return '<tr><td><strong>'+s.source_name+'</strong></td><td><span class="badge">'+s.source_type+'</span></td>'+
            '<td>'+dots+'</td><td>'+(s.url?'<a href="'+s.url+'" target="_blank" class="source-link">访问</a>':'—')+'</td>'+
            '<td>'+s.used_count+'</td><td>'+(s.retrieval_date||'—')+'</td></tr>';
    }).join('');
}
