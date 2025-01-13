const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Map to store client WebSocket connections
let clients = new Map(); 

wss.on('connection', (ws) => {
    const clientId = uuidv4();  // Generate a new unique ID for each connection
    console.log("Client connected", clientId);

    // Send the client their unique ID
    ws.send(JSON.stringify({ type: 'connected', clientId }));

    // Store client connection in the map
    clients.set(clientId, { ws, inprogressDownloads: [] });

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
    
            // Capture the title from yt-dlp output
            process.stdout.on('data', (data) => {
                if (clients.has(clientId)) {
                    console.log(data);
    
                    // Extract file path from output
                    const destMatch = data.match(/Destination:\s*(.*)/);
                    if (destMatch) {
                        var fp = destMatch[1].trim();
                        clients.get(clientId).inprogressDownloads.push(fp);
                    }

                    const matchMerge = data.match(/"([^"]+)"/);
                    if (matchMerge) {
                        var fp = matchMerge[1].trim();
                        console.log("matchMerge", fp);
                        clients.get(clientId).inprogressDownloads.push(fp);
                    }     
    
                    ws.send(JSON.stringify({ type: 'downloadLog', message: data }));
                }
            });
    
            process.stderr.on('data', (data) => {
                console.error(data);
                if (clients.has(clientId)) {
                    ws.send(JSON.stringify({ type: 'downloadLog', message: `ERROR: ${data}` }));
                }
            });
    
            process.on('close', (code) => {
                console.log(`Process exited with code: ${code}`);
                
                if (code !== 0) {
                    console.error(`Error: Download failed with exit code ${code}. Skipping ZIP creation.`);
                    if (clientId && clients.has(clientId)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Download failed. Please try again.' }));
                    }
                    return; // Exit early to skip further steps
                }
            
                if (clients.has(clientId)) {
                    ws.send(JSON.stringify({ type: 'downloadStatus', message: 'Download complete! Zipping please wait...' }));
    
                    // Create a ZIP file of the downloaded files using the song/playlist name
                    const timestamp = new Date().toISOString().replace(/[:.-]/g, "_");
                    const zipFilePath = `./public/downloads/${timestamp}.zip`;
    
                    const output = fs.createWriteStream(zipFilePath);
                    const archive = archiver('zip', { zlib: { level: 9 } });
    
                    output.on('close', () => {
                        console.log(`ZIP file created: ${zipFilePath}`);
                        ws.send(JSON.stringify({ type: 'downloadLink', url: `/downloads/${path.basename(zipFilePath)}`, filename: path.basename(zipFilePath) }));
                    });
    
                    archive.on('error', (err) => {
                        console.error('Error creating zip file', err);
                    });
    
                    // Add files to the zip archive
                    clients.get(clientId).inprogressDownloads.forEach((file) => {
                        archive.file(file, { name: path.basename(file) });
                    });
    
                    archive.pipe(output);
                    archive.finalize();
    
                    // Clear in-progress downloads after finishing
                    clients.get(clientId).inprogressDownloads = [];
                }
            });
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        clients.delete(clientId);  // Remove client from the map
    });
});

server.listen(3000, () => {
    console.log('Server running on http://127.0.0.1:3000');
});
