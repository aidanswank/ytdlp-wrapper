const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
var { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');

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

// // Handle Socket.IO connections
// io.on('connection', (socket) => {
//   console.log('A user connected:', socket.id);

//   // Listen for download requests
//   socket.on('downloadRequest', (data) => {
//     console.log('Download request received:', data);

//     // Process the download (stub logic)
//     const { url, format } = data;
//     console.log(`Processing download for URL: ${url}, Format: ${format}`);

//     var otherOptions = '';
//     if(format == 'wav') {
//       otherOptions = "--extract-audio --audio-format wav";
//     }
//     if(format == 'mp3') {
//       otherOptions = "--extract-audio --audio-format mp3";
//     }
//     const command = `yt-dlp ${otherOptions} "${url}" -o "./public/downloads/%(title)s.%(ext)s"`;
//     console.log("full command ", command);
  
//     const process = exec(command);

//     process.stdout.on('data', (data) => {
//       console.log(data);
//     });

//     // Emit status updates to the client
//     socket.emit('downloadStatus', 'Your download is being processed...');
    
//     // Example of sending additional updates
//     setTimeout(() => {
//       socket.emit('downloadStatus', 'Download is ready!');
//     }, 5000);
//   });

//   socket.on('disconnect', () => {
//     console.log('A user disconnected:', socket.id);
//   });
// });

io.on('connection', (socket) => {
  const clientId = socket.handshake.headers.cookie
    ?.split('; ')
    ?.find((row) => row.startsWith('clientId='))
    ?.split('=')[1];

  console.log(`Client connected: ${clientId || 'Unknown ID'}`);
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

    // Send real-time logs to the client
    process.stdout.on('data', (data) => {
      console.log(data); // Log to the server console
      socket.emit('downloadLog', data); // Send log to the client
    });

    process.stderr.on('data', (data) => {
      console.error(data); // Log errors to the server console
      socket.emit('downloadLog', `ERROR: ${data}`); // Send error to the client
    });

    process.on('close', (code) => {
      console.log(`Process exited with code: ${code}`);
      socket.emit('downloadStatus', 'Download complete!');
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${clientId}`);
  });
});


server.listen(3000, () => {
  console.log('Server running on http://127.0.0.1:3000');
});
