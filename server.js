var express = require('express');
var app = express();
var server = require('http').Server(app);
var { exec } = require('child_process');

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

server.listen(3000, function () {
  console.log(`Listening on http://127.0.0.1:${server.address().port}`);
});

app.use(express.json());  // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded data

const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

// app.post('/send_url', (req, res) => {
//   const videoUrl = req.body.url;

//   console.log("Received URL:", videoUrl);

//   if (!videoUrl) {
//     res.status(400).send("URL is required!");
//     return;
//   }

//   // Call yt-dlp using child_process
//   const command = `yt-dlp "${videoUrl}" -o "./public/downloads/%(title)s.%(ext)s"`;

//   exec(command, (error, stdout, stderr) => {
//     if (error) {
//       console.error(`Error executing yt-dlp: ${error.message}`);
//       console.error(`stderr: ${stderr}`);
//       res.status(500).send("Failed to download video. Check server logs.");
//       return;
//     }

//     console.log(`yt-dlp stdout: ${stdout}`);
//     console.log(`yt-dlp stderr: ${stderr}`);

//     // Extract the file paths from stdout
//     const filePaths = [];
//     stdout.split('\n').forEach(line => {
//       const match = line.match(/Destination: (.+)$/);
//       if (match) {
//         const filePath = match[1].trim();
//         filePaths.push(filePath);
//       }
//     });

//     // Create a ZIP file with all downloaded files
//     const zipFilePath = './public/downloads/downloaded_files.zip';
//     const output = fs.createWriteStream(zipFilePath);
//     const archive = archiver('zip', {
//       zlib: { level: 9 } // Set compression level
//     });

//     output.on('close', function () {
//       console.log(`ZIP file has been finalized and the total bytes are ${archive.pointer()}`);
//       res.send(`
//         Video download started for URL: ${videoUrl}<br>
//         <a href="/downloads/downloaded_files.zip" target="_blank">Download ZIP of all files</a><br>
//         <textarea>${stdout}</textarea>
//       `);
//     });

//     archive.on('error', function (err) {
//       res.status(500).send("Error creating ZIP file: " + err.message);
//     });

//     // Append downloaded files to the ZIP archive
//     filePaths.forEach(filePath => {
//       archive.file(filePath, { name: path.basename(filePath) });
//     });

//     archive.pipe(output);
//     archive.finalize();
//   });
// });

const connections = []; // Store active SSE connections

// SSE endpoint for progress updates
app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Add connection to active connections list
  connections.push(res);

  // Remove connection on client disconnect
  req.on('close', () => {
    const index = connections.indexOf(res);
    if (index !== -1) connections.splice(index, 1);
  });
});

// Utility function to broadcast progress
const broadcastProgress = (data) => {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  connections.forEach((res) => res.write(message));
};

// Main route to handle downloads
app.post('/send_url', (req, res) => {
  const videoUrl = req.body.url;

  if (!videoUrl) {
    res.status(400).send("URL is required!");
    return;
  }

  broadcastProgress({ type: 'progress', message: 'Download started...' });

  const command = `yt-dlp "${videoUrl}" -o "./public/downloads/%(title)s.%(ext)s"`;
  const process = exec(command);

  let downloadedFiles = [];

  process.stdout.on('data', (data) => {
    broadcastProgress({ type: 'progress', message: data.trim() });
    console.log("data start!", data, "data end!");
    
    const regex = /Destination:\s*(.*)/;

    // Extract the file path
    const match = data.match(regex);
    
    if (match) {
      // Trim any unwanted spaces and add to downloadedFiles array
      downloadedFiles.push(match[1].trim());
      console.log("FOUNd!", downloadedFiles);
    }

  });

  process.stderr.on('data', (data) => {
    console.error(data);
    broadcastProgress({ type: 'progress', message: data.trim() });
  });

  process.on('close', (code) => {
    console.log(`yt-dlp exited with code ${code}`);
    broadcastProgress({ type: 'progress', message: `Download process completed with code ${code}` });

    const zipFilePath = './public/downloads/downloaded_files.zip';
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`ZIP file created: ${zipFilePath}`);
      broadcastProgress({ type: 'zip-created', zipUrl: '/downloads/downloaded_files.zip' });
    });

    archive.on('error', (err) => {
      broadcastProgress({ type: 'progress', message: `Error creating ZIP: ${err.message}` });
    });

    console.log(downloadedFiles);

    downloadedFiles.forEach((file) => {
      archive.file(file, { name: path.basename(file) });
    });

    archive.pipe(output);
    archive.finalize();
  });

  res.send("Download started. Check the progress in the updates area.");
});