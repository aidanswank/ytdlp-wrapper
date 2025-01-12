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


const connections = []; // Store active SSE connections
var recentFiles = [];

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
  const format = req.body.format; // Get the selected format ("video" or "wav")

  console.log("Received URL:", videoUrl);
  console.log("Selected format:", format);


  if (!videoUrl) {
    res.status(400).send("URL is required!");
    return;
  }

  broadcastProgress({ type: 'progress', message: 'Download started...' });

  // const command = `yt-dlp --extract-audio --audio-format wav "${videoUrl}" -o "./public/downloads/%(title)s.%(ext)s"`;
  var otherOptions = '';
  if(format == 'wav') {
    otherOptions = "--extract-audio --audio-format wav";
  }
  if(format == 'mp3') {
    otherOptions = "--extract-audio --audio-format mp3";
  }
  const command = `yt-dlp ${otherOptions} "${videoUrl}" -o "./public/downloads/%(title)s.%(ext)s"`;
  console.log("full command ", command);

  const process = exec(command);

  let downloadedFiles = [];

  process.stdout.on('data', (data) => {
    broadcastProgress({ type: 'progress', message: data.trim() });
    console.log("data start!", data, "data end!");
    
    // Extract the file path
    const destMatch = data.match(/Destination:\s*(.*)/);
    if (destMatch) {
      // Trim any unwanted spaces and add to downloadedFiles array
      var fp = destMatch[1].trim();
      downloadedFiles.push(fp);
      console.log("destMatch", fp);
    }

    const matchMerge = data.match(/"([^"]+)"/);
    if (matchMerge) {
      var fp = matchMerge[1].trim();
      console.log("matchMerge", fp);
      downloadedFiles.push(fp);
    }

    downloadedFiles.forEach((file) => {
      console.log("schedule deletes...", file);
      // Schedule deletion of the ZIP file after 5 minutes (300,000 ms)
      setTimeout(() => {
        fs.unlink(file, (err) => {
          if (err) {
            console.error(`Error deleting file: ${err.message}`);
          } else {
            console.log(`file deleted: ${file}`);
          }
        });
      }, 1 * 60 * 1000); // 5 minutes in milliseconds
    });

  });

  process.stderr.on('data', (data) => {
    console.error(data);
    broadcastProgress({ type: 'progress', message: data.trim() });
  });

  process.on('close', (code) => {
    console.log(`yt-dlp exited with code ${code}`);
    broadcastProgress({ type: 'progress', message: `Download process completed with code ${code}` });
  
    // Generate a unique ZIP file name using a timestamp or random string
    const timestamp = new Date().toISOString().replace(/[:.-]/g, "_"); // Replace invalid characters
    const zipFilePath = `./public/downloads/downloaded_files_${timestamp}.zip`;
  
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
  
    output.on('close', () => {
      console.log(`ZIP file created: ${zipFilePath}`);
      broadcastProgress({ type: 'zip-created', zipUrl: `/downloads/${path.basename(zipFilePath)}` });

      // Schedule deletion of the ZIP file after 5 minutes (300,000 ms)
      setTimeout(() => {
        fs.unlink(zipFilePath, (err) => {
          if (err) {
            console.error(`Error deleting ZIP file: ${err.message}`);
          } else {
            console.log(`ZIP file deleted: ${zipFilePath}`);
          }
        });
      }, 1 * 60 * 1000); // 5 minutes in milliseconds
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