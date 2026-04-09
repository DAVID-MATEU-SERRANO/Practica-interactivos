const videoElement = document.querySelector('#webcam');
const canvas = document.querySelector('#outputCanvas');
const ctx = canvas.getContext('2d');
//canvas.style.display = 'none';
let frameData;

// 1. Configuración de acceso a la cámara (Transparencia 1)
async function initCamera() {
    const constraints = {
        video: {
            facingMode: 'user', // 'user' para frontal, 'environment' para trasera
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    try {
        const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = currentStream;

        // Iniciamos el bucle de captura una vez el video esté listo
        videoElement.onloadedmetadata = () => {
            // Ajustamos el tamaño del canvas al del video real
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            captureFrame();
        };
    } catch (err) {
        console.error('Error accediendo a la cámara:', err);
    }
}

// 2. Bucle de captura de fotogramas 
function captureFrame() {
    // Dibujamos el estado actual del video en el canvas
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Extraemos los datos del fotograma (como URL de imagen base64)
    frameData = canvas.toDataURL('image/png');

    // Solicitamos el siguiente refresco de pantalla (aprox 60fps)
    requestAnimationFrame(captureFrame);
}

// Arrancar la aplicación
initCamera();