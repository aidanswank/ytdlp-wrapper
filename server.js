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

// app.post('/send_url', (req, res) => {
//   console.log(req.body);
//   res.send("downloading "+req.body.url);
// });

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

//     // Log outputs to the console
//     console.log(`yt-dlp stdout: ${stdout}`);
//     console.log(`yt-dlp stderr: ${stderr}`);

//     dlUrl = "insert here";

//     res.send(`Video download started for URL: ${videoUrl}<br>dl ${dlUrl} <br><textarea>${stdout}</textarea>`);
//   });
// });

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

//     // Extract the file path from stdout
//     const match = stdout.match(/Destination: (.+)$/m);
//     let dlUrl = match ? match[1].trim() : "Could not determine file path.";

//     // Convert to a public URL path
//     dlUrl = dlUrl.startsWith('./public') ? dlUrl.replace('./public', '') : dlUrl;

//     console.log("extracted path ", dlUrl);

//     res.send(`
//       Video download started for URL: ${videoUrl}<br>
//       Download link: <a href="${dlUrl}" target="_blank">${dlUrl}</a><br>
//       <textarea>${stdout}</textarea>
//     `);
//   });
// });

const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

app.post('/send_url', (req, res) => {
  const videoUrl = req.body.url;

  console.log("Received URL:", videoUrl);

  if (!videoUrl) {
    res.status(400).send("URL is required!");
    return;
  }

  // Call yt-dlp using child_process
  const command = `yt-dlp "${videoUrl}" -o "./public/downloads/%(title)s.%(ext)s"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp: ${error.message}`);
      console.error(`stderr: ${stderr}`);
      res.status(500).send("Failed to download video. Check server logs.");
      return;
    }

    console.log(`yt-dlp stdout: ${stdout}`);
    console.log(`yt-dlp stderr: ${stderr}`);

    // Extract the file paths from stdout
    const filePaths = [];
    stdout.split('\n').forEach(line => {
      const match = line.match(/Destination: (.+)$/);
      if (match) {
        const filePath = match[1].trim();
        filePaths.push(filePath);
      }
    });

    // Create a ZIP file with all downloaded files
    const zipFilePath = './public/downloads/downloaded_files.zip';
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Set compression level
    });

    output.on('close', function () {
      console.log(`ZIP file has been finalized and the total bytes are ${archive.pointer()}`);
      res.send(`
        Video download started for URL: ${videoUrl}<br>
        <a href="/downloads/downloaded_files.zip" target="_blank">Download ZIP of all files</a><br>
        <textarea>${stdout}</textarea>
      `);
    });

    archive.on('error', function (err) {
      res.status(500).send("Error creating ZIP file: " + err.message);
    });

    // Append downloaded files to the ZIP archive
    filePaths.forEach(filePath => {
      archive.file(filePath, { name: path.basename(filePath) });
    });

    archive.pipe(output);
    archive.finalize();
  });
});

// // SSE endpoint for real-time updates
// app.get('/progress', (req, res) => {
//   res.setHeader('Content-Type', 'text/event-stream');
//   res.setHeader('Cache-Control', 'no-cache');
//   res.setHeader('Connection', 'keep-alive');

//   // Keep the connection open
//   res.flushHeaders();

//   let interval = setInterval(() => {
//     res.write(`:\n\n`); // Keep-alive ping
//   }, 15000);

//   req.on('close', () => {
//     clearInterval(interval); // Stop keep-alive when connection closes
//   });

//   // Function to send data
//   const sendMessage = (message) => {
//     res.write(`data: ${JSON.stringify({ message })}\n\n`);
//   };

//   req.app.set('sendProgress', sendMessage); // Store in app for the other route to use
// });

// // Main route to handle downloads
// app.post('/send_url', (req, res) => {
//   const videoUrl = req.body.url;

//   if (!videoUrl) {
//     res.status(400).send("URL is required!");
//     return;
//   }

//   const sendProgress = req.app.get('sendProgress');
//   const command = `yt-dlp "${videoUrl}" -o "./public/downloads/%(title)s.%(ext)s"`;

//   const process = exec(command);

//   let downloadedFiles = [];

//   process.stdout.on('data', (data) => {
//     console.log(data);
//     if (sendProgress) sendProgress(data);

//     // Extract file paths
//     const match = data.match(/Destination: (.+)$/);
//     if (match) {
//       downloadedFiles.push(match[1].trim());
//     }
//   });

//   process.stderr.on('data', (data) => {
//     console.error(data);
//     if (sendProgress) sendProgress(data);
//   });

//   process.on('close', (code) => {
//     console.log(`yt-dlp exited with code ${code}`);
//     if (sendProgress) sendProgress(`Download process completed with code ${code}`);

//     // Create ZIP file with all downloaded files
//     const zipFilePath = './public/downloads/downloaded_files.zip';
//     const output = fs.createWriteStream(zipFilePath);
//     const archive = archiver('zip', { zlib: { level: 9 } });

//     output.on('close', () => {
//       console.log(`ZIP file created: ${zipFilePath}`);
//       if (sendProgress) sendProgress(`ZIP file created: <a href="/downloads/downloaded_files.zip">Download ZIP</a>`);
//     });

//     archive.on('error', (err) => {
//       if (sendProgress) sendProgress(`Error creating ZIP: ${err.message}`);
//     });

//     downloadedFiles.forEach((file) => {
//       archive.file(file, { name: path.basename(file) });
//     });

//     archive.pipe(output);
//     archive.finalize();
//   });

//   res.send("Download started. Check the progress in the updates area.");
// });