const output = document.getElementById("output");

// Initialize worker
const worker = new Worker("worker.js");

document.getElementById("start").onclick = function () {
    output.innerHTML += "<p>Started heavy computation...</p>";
    // Large number for intensive computation 
    worker.postMessage(5000000000);
};


// Listen for messages from the worker
worker.onmessage = function (event) {
    output.innerHTML += `<p>Result from worker: ${event.data}</p>`;
};
