const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);

// CORSヘッダーをすべてのリクエストに追加
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// WebSocketサーバーの設定を更新
const wss = new WebSocket.Server({ 
    server,
    verifyClient: (info) => {
        // オリジンの検証をスキップしてすべての接続を許可
        return true;
    }
});

// ストリーム管理用のMap
const streams = new Map();

// FFmpegプロセスの作成
function createFFmpegProcess(streamKey, pass) {
    const rtmpUrl = `rtmp://nginx-rtmp:1935${pass}/${streamKey}`;

    return spawn('ffmpeg', [
        '-fflags', '+nobuffer',
        '-flags', 'low_delay',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'faster', 
        '-tune', 'zerolatency',
        '-profile:v', 'high', 
        '-crf', '18',
        '-threads', '8',
        '-keyint_min', '60',
        '-force_key_frames', 'expr:gte(t,n_forced*2)',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-ac', '2',
        '-f', 'flv',
        rtmpUrl
    ]);
}

// クリーンアップ関数を追加
function cleanupStream(streamKey) {
    console.log(`Cleaning up stream: ${streamKey}`);
    if (streams.has(streamKey)) {
        const stream = streams.get(streamKey);
        
        // FFmpegプロセスの終了処理を改善
        if (stream.ffmpeg) {
            try {
                // 正常な終了を試みる
                if (stream.ffmpeg.stdin.writable) {
                    stream.ffmpeg.stdin.end();
                }
                
                // プロセスを終了
                stream.ffmpeg.kill('SIGTERM');
                
                // 一定時間後にまだ終了していない場合は強制終了
                setTimeout(() => {
                    try {
                        if (!stream.ffmpeg.killed) {
                            stream.ffmpeg.kill('SIGKILL');
                        }
                    } catch (error) {
                        console.log('Process already terminated');
                    }
                }, 1000);
            } catch (error) {
                console.log('FFmpeg process already terminated');
            }
        }

        try {
            if (stream.ws && stream.ws.readyState === WebSocket.OPEN) {
                stream.ws.close();
            }
        } catch (error) {
            console.log('WebSocket already closed');
        }

        streams.delete(streamKey);
    }
}

// WebSocket接続のハンドリングを更新
wss.on('connection', async (ws, req) => {
    const requrl = req.url;
    const streamKey = requrl.split('?')[0].split('/').pop();
    console.log(`New connection for stream: ${streamKey}`);
    const queryParams = new URLSearchParams(requrl.split('?')[1]);
    console.log(queryParams)
    const password = queryParams.get('password');
    const pass = `/live?password=${password}`;

    const liveAuht = await fetch(`http://main-backend:3001/rtmp-auth`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `name=${encodeURIComponent(streamKey)}&tcurl=${encodeURIComponent(`rtmp://nginx-trmp:1935${pass}`)}`
    });
    if(!liveAuht.ok){
        return false;
    }

    let isCleaningUp = false;

    // 新しいFFmpegプロセスを作成
    const ffmpeg = createFFmpegProcess(streamKey, pass);
    const stream = { ffmpeg, ws };
    streams.set(streamKey, stream);

    // メッセージ処理を最適化
    const writeQueue = [];
    let isWriting = false;

    async function processWriteQueue() {
        if (isWriting || writeQueue.length === 0) return;
        isWriting = true;

        try {
            while (writeQueue.length > 0) {
                const data = writeQueue.shift();
                if (ffmpeg.stdin && ffmpeg.stdin.writable) {
                    await new Promise((resolve, reject) => {
                        ffmpeg.stdin.write(data, (error) => {
                            if (error) reject(error);
                            else resolve();
                        });
                    });
                }
            }
        } catch (error) {
            console.error(`Error processing write queue:`, error);
            safeCleanup();
        } finally {
            isWriting = false;
            if (writeQueue.length > 0) {
                processWriteQueue();
            }
        }
    }

    ws.on('message', (data) => {
        if (!isCleaningUp) {
            writeQueue.push(data);
            processWriteQueue();
        }
    });

    // 安全なクリーンアップ関数
    const safeCleanup = () => {
        if (!isCleaningUp) {
            isCleaningUp = true;
            cleanupStream(streamKey);
        }
    };

    // エラーハンドリングを改善
    ffmpeg.stderr.on('data', (data) => {
        const log = data.toString();
        if (log.includes('Error') || log.includes('Failed')) {
            console.error(`FFmpeg Error (${streamKey}):`, log);
        }
    });

    ffmpeg.on('error', (error) => {
        console.error(`FFmpeg process error for stream ${streamKey}:`, error);
        safeCleanup();
    });

    ffmpeg.on('exit', (code, signal) => {
        console.log(`FFmpeg process exited for stream ${streamKey} with code ${code} and signal ${signal}`);
        safeCleanup();
    });

    ws.on('close', async () => {
        console.log(`WebSocket closed for stream: ${streamKey}`);
        try {
            const pass = `/live?password=${password}`;
            const liveAuth = await fetch(`http://main-backend:3001/stream_end`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `name=${encodeURIComponent(streamKey)}&tcurl=${encodeURIComponent(`rtmp://nginx-rtmp:1935${pass}`)}`
            });
            if(!liveAuth.ok){
                return false;
            }
            console.log('Stream close check result:', liveAuth);
        } catch (error) {
            console.error('Error checking stream on close:', error);
        }
        safeCleanup();
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for stream ${streamKey}:`, error);
        safeCleanup();
    });
});

// プロセス終了時のクリーンアップを追加
process.on('SIGINT', () => {
    console.log('Server shutting down, cleaning up all streams...');
    for (const [streamKey] of streams) {
        cleanupStream(streamKey);
    }
    process.exit(0);
});

// プロセス終了時のエラーハンドリングを改善
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (error.code === 'EPIPE') {
        console.log('Ignoring EPIPE error');
        return;
    }
    // 重大なエラーの場合のみプロセスを終了
    process.exit(1);
});
// サーバー起動
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
