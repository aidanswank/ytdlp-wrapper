console.log("hello");

const socket = new WebSocket('ws://127.0.0.1:3000');

socket.onopen = () => {
    console.log('Connected to the WebSocket server');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'connected') {
        console.log('Connected with Client ID:', data.clientId);
    } else if (data.type === 'downloadLog') {
        console.log(data.message);
        const textarea = document.getElementById('logs'); // Assume a textarea with this ID exists
        textarea.value += `${data.message}`; // Append logs to the textarea
        textarea.scrollTop = textarea.scrollHeight; // Auto-scroll to the bottom
    } else if (data.type === 'downloadStatus') {
        console.log('Status:', data.message);
    } else if (data.type === 'downloadLink') {
        const linkElement = document.getElementById('downloadLink');
        if (linkElement) {
            linkElement.href = data.url;
            linkElement.textContent = "Download File"; // Update the visible text of the link
            linkElement.style.display = "inline"; // Ensure it's visible
        } else {
            console.error("Element with ID 'downloadLink' not found.");
        }
    }
};

socket.onclose = () => {
    console.log('Disconnected from the WebSocket server!');
};

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

    socket.send(JSON.stringify({
        type: 'downloadRequest',
        url,
        format,
        clientId
    }));

    console.log('Download request sent:', { url, format, clientId });
});
