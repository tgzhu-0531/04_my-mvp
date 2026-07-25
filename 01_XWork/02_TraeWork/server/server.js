// ============================================================
// 城市分时电价观察站 - SQLite 数据接口服务
// 用途: 仅用于本地完整验证场景 (dataSource: "sqlite")
// 端口: 3456
// 启动: npm install && npm start
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3456;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 - 提供前端页面
app.use(express.static(path.join(__dirname, '..')));

// ======== API 路由 ========

// 获取配置信息
app.get('/api/config', (req, res) => {
    res.json({
        appName: '城市分时电价观察站',
        version: '1.0.0',
        dataSource: 'sqlite',
        provinces: ['广东', '江苏', '山东', '浙江', '内蒙古'],
        lastUpdated: '2026-07-25'
    });
});

// 获取所有省份
app.get('/api/regions', (req, res) => {
    try {
        const regions = db.getAllRegions();
        res.json({ success: true, data: regions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取所有数据来源
app.get('/api/sources', (req, res) => {
    try {
        const sources = db.getAllSources();
        res.json({ success: true, data: sources });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取所有电价政策
app.get('/api/policies', (req, res) => {
    try {
        const { province } = req.query;
        const policies = db.getPolicies(province);
        res.json({ success: true, data: policies });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取指定省份的分时时段
app.get('/api/periods', (req, res) => {
    try {
        const { province, season } = req.query;
        const periods = db.getPeriods(province, season);
        res.json({ success: true, data: periods });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取缺失记录
app.get('/api/missing', (req, res) => {
    try {
        const { province } = req.query;
        const records = db.getMissingRecords(province);
        res.json({ success: true, data: records });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取概览统计数据
app.get('/api/overview', (req, res) => {
    try {
        const overview = db.getOverview();
        res.json({ success: true, data: overview });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取24小时电价曲线数据
app.get('/api/daily-curve', (req, res) => {
    try {
        const { province, season } = req.query;
        const curve = db.getDailyCurve(province, season);
        res.json({ success: true, data: curve });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  城市分时电价观察站 - 数据接口服务`);
    console.log(`  地址: http://localhost:${PORT}`);
    console.log(`  数据源: SQLite`);
    console.log(`  提示: 请将 config.json 中的 dataSource 设为 "sqlite"`);
    console.log(`========================================`);
});