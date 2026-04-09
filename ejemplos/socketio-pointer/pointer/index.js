const express = require('express');
const app = express();
const path = require('path');
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use('/', express.static(path.join(__dirname, 'www')));

let clientSocket;

io.on('connection', (socket) => {
  console.log(`socket connected ${socket.id}`);

  socket.on("POINTER_CONNECTED", () => {
    socket.emit("ACK_CONNECTION");
    if (clientSocket) clientSocket.emit("NEW_POINTER", { pointerId: socket.id });
  });

  socket.on("SENSOR_READING", (data) => {
    //console.log(data);
    if (clientSocket) clientSocket.emit("SENSOR_READING", {
      pointerId: socket.id,
      coords: data
    });
  });

  socket.on("CLIENT_CONNECTED", () => {
    clientSocket = socket;
    clientSocket.emit("ACK_CONNECTION");
  })
});

server.listen(3000, () => {
  console.log("Server listening...");
});