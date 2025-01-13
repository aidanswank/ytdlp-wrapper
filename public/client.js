console.log("hello");

const socket = io();

socket.on('connected', (data) => {
    console.log('Connected with Client ID:', data.clientId);
    console.log('Files:', data.downloadedFiles);
});

socket.on('disconnect', () => {
    console.log('Disconnected from the server!');
});

// Handle form submission
document.getElementById('downloadForm').addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent default form submission

    const clientId = document.cookie
    .split('; ')
    .find((row) => row.startsWith('clientId='))
    ?.split('=')[1];

    if (!clientId) {
        console.error('No clientId found in cookies!');
        return;
    }

    // Extract data from the form
    const url = document.getElementById('url').value;
    const format = document.getElementById('format').value;

    socket.emit('downloadRequest', { url, format, clientId });

    console.log('Download request sent:', { url, format, clientId });
});

socket.on('downloadLog', (message) => {
    console.log(message)
    const textarea = document.getElementById('logs'); // Assume a textarea with this ID exists
    textarea.value += `${message}`; // Append logs to the textarea
    textarea.scrollTop = textarea.scrollHeight; // Auto-scroll to the bottom
});

socket.on('downloadStatus', (message) => {
    console.log('Status:', message);
});

socket.on('downloadLink', (url) => {
    console.log("download link", url);
    const linkElement = document.getElementById('downloadLink'); 
    
    if (linkElement) {
        // Set the href and text content dynamically
        linkElement.href = url;
        linkElement.textContent = "Download File"; // Update the visible text of the link
        linkElement.style.display = "inline"; // Ensure it's visible
    } else {
        console.error("Element with ID 'downloadLink' not found.");
    }
});