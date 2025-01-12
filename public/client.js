console.log("hello");

const socket = io();

socket.on('connected', (data) => {
    console.log('Connected with Client ID:', data.clientId);
});

socket.on('disconnect', () => {
    console.log('Disconnected from the server!');
});

// // Handle form submission
// document.getElementById('downloadForm').addEventListener('submit', (event) => {
//     event.preventDefault(); // Prevent default form submission

//     // Extract data from the form
//     const url = document.getElementById('url').value;
//     const format = document.getElementById('format').value;

//     // Emit the data to the server via Socket.IO
//     socket.emit('downloadRequest', { url, format });

//     console.log('Download request sent:', { url, format });
// });

// // Listen for server responses
// socket.on('downloadStatus', (message) => {
//     console.log('Server:', message);
// });

 // Handle form submission
 document.getElementById('downloadForm').addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent default form submission

    // Extract data from the form
    const url = document.getElementById('url').value;
    const format = document.getElementById('format').value;

    // Emit the data to the server
    socket.emit('downloadRequest', { url, format });

    console.log('Download request sent:', { url, format });
  });

  // Append logs to the <textarea>
  socket.on('downloadLog', (log) => {
    console.log(log);
    const logs = document.getElementById('logs');
    logs.scrollTop = logs.scrollHeight; // Auto-scroll to the latest log
  });

  // Listen for status updates
  socket.on('downloadStatus', (message) => {
    console.log('Status:', message);
    const logs = document.getElementById('logs');
    logs.value += message + '\n';
    logs.scrollTop = logs.scrollHeight;
  });