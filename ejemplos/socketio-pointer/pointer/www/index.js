const socket = io();

const qrcode = new QRCode("qrcode", {
  text: "http://localhost:3000/pointer/pointer.html",
  width: 512,
  height: 512,
  colorDark: "#000000",
  colorLight: "#ffffff",
  correctLevel: QRCode.CorrectLevel.H
});

socket.on("connect", () => {
  socket.emit("CLIENT_CONNECTED", { id: 1 });

  socket.on("ACK_CONNECTION", () => {
    console.log("ACK");
  });

  socket.on("NEW_POINTER", (data) => {
    console.log("new pointer");
    const pointerEl = document.createElement("div");
    pointerEl.id = data.pointerId;
    pointerEl.classList.add("pointer");
    pointerEl.style.backgroundColor = Math.floor(Math.random() * 16777215).toString(16);
    document.body.appendChild(pointerEl);

  })

  socket.on("SENSOR_READING", (data) => {
    //console.log(data);
    const cursor = document.querySelector(`#${data.pointerId}`);
    if (cursor) {
      cursor.style.left = data.coords[0] + window.innerWidth / 2;
      cursor.style.top = data.coords[1] + window.innerHeight / 2;
    }

  });

});

