const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
var { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const archiver = require('archiver');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cookieParser());

// Middleware to assign a persistent client ID
app.use((req, res, next) => {
    if (!req.cookies.clientId) {
        const clientId = uuidv4(); // Generate a unique ID
        res.cookie('clientId', clientId, { maxAge: 86400000 }); // Set cookie for 1 day
    }
    next();
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

var clients = new Map(); // Map to store clientId -> WebSocket

wss.on('connection', (ws, req) => {

    const clientId = uuidv4();

    if (clientId) {
        if (!clients.has(clientId)) {
            clients.set(clientId, {
                ws,
                inprogressDownloads: [] // Initialize an empty array
            });
        } else {
            clients.get(clientId).ws = ws;
        }

        console.log("Client connected", clientId);
    } else {
        console.log('Client connected without an ID!');
    }

    // Send the client their unique ID
    ws.send(JSON.stringify({ type: 'connected', clientId }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'downloadRequest') {
            console.log('Download request received:', data);

            const { url, format } = data;
            console.log(`Processing download for URL: ${url}, Format: ${format}`);

            let otherOptions = '';
            if (format === 'wav') {
                otherOptions = '--extract-audio --audio-format wav';
            } else if (format === 'mp3') {
                otherOptions = '--extract-audio --audio-format mp3';
            }
            const command = `yt-dlp ${otherOptions} "${url}" -o "./public/downloads/%(title)s.%(ext)s"`;
            console.log('Full command:', command);

            const process = exec(command);

            // Send real-time logs to the specific client
            process.stdout.on('data', (data) => {
                if (clientId && clients.has(clientId)) {
                    console.log(data);
                    // Extract the file path
                    const destMatch = data.match(/Destination:\s*(.*)/);
                    if (destMatch) {
                        var fp = destMatch[1].trim();
                        clients.get(clientId).inprogressDownloads.push(fp);
                    }

                    const matchMerge = data.match(/"([^"]+)"/);
                    if (matchMerge) {
                        var fp = matchMerge[1].trim();
                        clients.get(clientId).inprogressDownloads.push(fp);
                    }

                    console.log("Sending to client", clientId);
                    ws.send(JSON.stringify({ type: 'downloadLog', message: data }));
                }
            });

            process.stderr.on('data', (data) => {
                console.error(data);
                if (clientId && clients.has(clientId)) {
                    ws.send(JSON.stringify({ type: 'downloadLog', message: `ERROR: ${data}` }));
                }
            });

            process.on('close', (code) => {
                console.log(`Process exited with code: ${code}`);
                if (clientId && clients.has(clientId)) {
                    ws.send(JSON.stringify({ type: 'downloadStatus', message: 'Download complete!' }));

                    // Generate a unique ZIP file name using a timestamp or random string
                    const timestamp = new Date().toISOString().replace(/[:.-]/g, "_"); // Replace invalid characters
                    const zipFilePath = `./public/downloads/downloaded_files_${timestamp}.zip`;
                
                    const output = fs.createWriteStream(zipFilePath);
                    const archive = archiver('zip', { zlib: { level: 9 } });
                
                    output.on('close', () => {
                        console.log(`ZIP file created: ${zipFilePath}`);
                        ws.send(JSON.stringify({ type: 'downloadLink', url: `/downloads/${path.basename(zipFilePath)}` }));
                    });
                
                    archive.on('error', (err) => {
                        console.error('Error creating zip file', err);
                    });

                    clients.get(clientId).inprogressDownloads.forEach((file) => {
                        archive.file(file, { name: path.basename(file) });
                    });

                    archive.pipe(output);
                    archive.finalize();

                    clients.get(clientId).inprogressDownloads = [];
                }
            });
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://127.0.0.1:3000');
});
