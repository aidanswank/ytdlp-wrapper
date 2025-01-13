const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
var { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const archiver = require('archiver');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

var clients = new Map(); // Map to store clientId -> socket.id

io.on('connection', (socket) => {
    const clientId = socket.handshake.headers.cookie
        ?.split('; ')
        ?.find((row) => row.startsWith('clientId='))
        ?.split('=')[1];

    // console.log("socket.id",socket.id);

    if (clientId) {

        if(!clients.has(clientId))
        {
            clients.set(clientId, { 
                socketId: socket.id, 
                inprogressDownloads: [] // Initialize an empty array
            });
        } else {
            clients.get(clientId).socketId = socket.id;
        }

            
        console.log("client connected", clientId, clients.get(clientId));

    } else {
        console.log('Client connected without an ID!');
    }

    // var inprogressDownloads = clients.get(clientId).inprogressDownloads;
    socket.emit('connected', { clientId });

    socket.on('downloadRequest', (data) => {
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
        console.log('full command:', command);

        const process = exec(command);

        // Send real-time logs to the specific client
        process.stdout.on('data', (data) => {
            if (clientId && clients.has(clientId)) {
                console.log(data);
                console.log("sending to ", clientId, clients.get(clientId));
                // Extract the file path
               const destMatch = data.match(/Destination:\s*(.*)/);
               if (destMatch) {
                   // Trim any unwanted spaces and add to inprogressDownloads array
                   var fp = destMatch[1].trim();
                   console.log("destMatch", fp);
                   clients.get(clientId).inprogressDownloads.push(fp);
               }
       
               const matchMerge = data.match(/"([^"]+)"/);
               if (matchMerge) {
                   var fp = matchMerge[1].trim();
                   console.log("matchMerge", fp);
                   clients.get(clientId).inprogressDownloads.push(fp);
               }
       
                console.log("client id",clients.get(clientId));
                io.to(clients.get(clientId).socketId).emit('downloadLog', data);
            }
        });

        process.stderr.on('data', (data) => {
            console.error(data);
            if (clientId && clients.has(clientId)) {
                io.to(clients.get(clientId).socketId).emit('downloadLog', `ERROR: ${data}`);
            }
        });

        process.on('close', (code) => {
            console.log(`Process exited with code: ${code}`);
            if (clientId && clients.has(clientId)) {
                io.to(clients.get(clientId).socketId).emit('downloadStatus', 'Download complete!');

                // Generate a unique ZIP file name using a timestamp or random string
                const timestamp = new Date().toISOString().replace(/[:.-]/g, "_"); // Replace invalid characters
                const zipFilePath = `./public/downloads/downloaded_files_${timestamp}.zip`;
            
                const output = fs.createWriteStream(zipFilePath);
                const archive = archiver('zip', { zlib: { level: 9 } });
            
                output.on('close', () => {
                    console.log(`ZIP file created: ${zipFilePath}`);
                    // broadcastProgress({ type: 'zip-created', zipUrl: `/downloads/${path.basename(zipFilePath)}` });
                    // io.to(clients.get(clientId).socketId).emit('downloadLog', `zip created /downloads/${path.basename(zipFilePath)}`);
                    io.to(clients.get(clientId).socketId).emit('downloadLink', `/downloads/${path.basename(zipFilePath)}`);

                    // // Schedule deletion of the ZIP file after 5 minutes (300,000 ms)
                    // setTimeout(() => {
                    //     fs.unlink(zipFilePath, (err) => {
                    //     if (err) {
                    //         console.error(`Error deleting ZIP file: ${err.message}`);
                    //     } else {
                    //         console.log(`ZIP file deleted: ${zipFilePath}`);
                    //     }
                    //     });
                    // }, 1 * 60 * 1000); // 5 minutes in milliseconds
                });
            
                archive.on('error', (err) => {
                    // TODO on error emit to
                });
            
                // console.log(inprogressDownloads);
                clients.get(clientId).inprogressDownloads.forEach((file) => {
                    // Add file to archive
                    archive.file(file, { name: path.basename(file) });
                
                    
                    // // Delete the file after archiving
                    // fs.unlink(file, (err) => {
                    //     if (err) {
                    //         console.error(`Error deleting file ${file}:`, err);
                    //     } else {
                    //         console.log(`File deleted: ${file}`);
                    //     }
                    // });
                });
            
                archive.pipe(output);
                archive.finalize();

                clients.get(clientId).inprogressDownloads = [];

            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${clientId}`);
        // if (clientId) {
        //     clients.delete(clientId); // Remove the client from the map
        // }
        // console.log(clients);
    });
});


server.listen(3000, () => {
    console.log('Server running on http://127.0.0.1:3000');
});
