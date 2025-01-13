console.log("hello");

const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const socketUrl = `${protocol}://${window.location.host}`;
const socket = new WebSocket(socketUrl);

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
        const status = document.getElementById('status'); // Assume a textarea with this ID exists
        status.innerHTML = data.message;
    } else if (data.type === 'downloadLink') {
        const linkContainer = document.getElementById('downloadLink');
        if (linkContainer) {
            // Create the <a> element dynamically
            const anchor = document.createElement('a');
            anchor.href = data.url; // Set the href property
            anchor.textContent = data.filename; // Set the text content
            anchor.style.display = "inline"; // Ensure it's visible
        
            // Append the <a> to the <p>
            linkContainer.appendChild(anchor);
        
            // Add the additional text
            const message = document.createTextNode(" File will be deleted in 5 minutes.");
            linkContainer.appendChild(message);
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

    // Extract data from the form
    const url = document.getElementById('url').value;
    const format = document.getElementById('format').value;

    socket.send(JSON.stringify({
        type: 'downloadRequest',
        url,
        format,
    }));

    console.log('Download request sent:', { url, format });
});
