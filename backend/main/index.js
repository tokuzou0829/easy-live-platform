import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'crypto';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.urlencoded({ extended: true }));

import fs from 'fs';

// SQLite設定
let db;
(async () => {
    // データディレクトリを作成
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    db = await open({
        filename: path.join(dataDir, 'live_platform.db'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS live_streams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            stream_key TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'offline',
            stream_access_key TEXT NOT NULL,
            overview TEXT,
            stream_start_time DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
})();

// ユーティリティ関数
function generateRandomKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// 配信作成エンドポイント
app.post('/streams', async (req, res) => {
    try {
        const { title, overview } = req.body;
        const stream_key = generateRandomKey(16);
        const stream_access_key = generateRandomKey(16);

        const result = await db.run(
            'INSERT INTO live_streams (title, overview, stream_key, stream_access_key) VALUES (?, ?, ?, ?)',
            [title, overview, stream_key, stream_access_key]
        );

        const stream = await db.get('SELECT * FROM live_streams WHERE id = ?', result.lastID);
        res.status(201).json(stream);
    } catch (error) {
        console.error('Create Stream Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 配信詳細取得エンドポイント
app.get('/streams/:streamKey', async (req, res) => {
    try {
        const stream = await db.get(
            'SELECT id, title, status, stream_key, overview, stream_start_time FROM live_streams WHERE stream_key = ?',
            req.params.streamKey
        );

        if (!stream) {
            return res.status(404).json({ error: 'Stream not found' });
        }

        res.json(stream);
    } catch (error) {
        console.error('Get Stream Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// オンライン配信一覧取得エンドポイント
app.get('/streams', async (req, res) => {
    try {
        const streams = await db.all(
            'SELECT id, title, status, stream_key, overview, stream_start_time FROM live_streams WHERE status = ?',
            ['online']
        );
        res.json({"lives":streams});
    } catch (error) {
        console.error('Get Streams Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// RTMP認証用ユーティリティ関数
function getParameterValueFromURL(url, parameter) {
    const searchParams = new URLSearchParams(url.split('?')[1]);
    return searchParams.get(parameter);
}

// RTMP認証エンドポイント
app.post('/rtmp-auth', async (req, res) => {
    try {
        const streamKey = req.body.name;
        const tcUrl = req.body.tcurl;        
        console.log(tcUrl)
        const accessKey = getParameterValueFromURL(tcUrl, "password");

        const stream = await db.get(
            'SELECT * FROM live_streams WHERE stream_key = ? AND stream_access_key = ?',
            [streamKey, accessKey]
        );

        if (!stream) {
            return res.status(403).json({ error: 'Invalid stream key or access key' });
        }

        await db.run(
            'UPDATE live_streams SET status = ?, stream_start_time = ? WHERE stream_key = ?',
            ['online', new Date().toISOString(), streamKey]
        );

        res.status(200).json({ message: 'Stream authorized' });
    } catch (error) {
        console.error('RTMP Auth Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ストリーム終了エンドポイント
app.post('/stream_end', async (req, res) => {
    try {
        const streamKey = req.body.name;
        const tcUrl = req.body.tcurl;
        const accessKey = getParameterValueFromURL(tcUrl, "password");

        const stream = await db.get(
            'SELECT * FROM live_streams WHERE stream_key = ? AND stream_access_key = ?',
            [streamKey, accessKey]
        );

        if (!stream) {
            return res.status(403).json({ error: 'Invalid stream key or access key' });
        }

        await db.run(
            'UPDATE live_streams SET status = ? WHERE stream_key = ?',
            ['offline', streamKey]
        );

        res.status(200).json({ message: 'Stream ended' });
    } catch (error) {
        console.error('Stream End Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
