import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureText = document.getElementById("gesture-name");
const angleText = document.getElementById("angle-val");
const normalText = document.getElementById("normal-val");

let handLandmarker;
let lastVideoTime = -1;

// 2. Crear la tarea (Paso 2)
async function createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    console.log(vision);

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    startCamera();
}

async function startCamera() {
    const constraints = { video: { width: 640, height: 480 } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    videoElement.addEventListener("loadeddata", predictWebcam);
}

// 3. Ejecutar la tarea (Paso 3)
async function predictWebcam() {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    let now = performance.now();
    let lastDetectionTime = 0;
    const detectionFPS = 20; // Queremos procesar la mano 20 veces por segundo
    const detectionInterval = 1000 / detectionFPS;

    if (now - lastDetectionTime >= detectionInterval) {
        const detections = handLandmarker.detectForVideo(videoElement, now);

        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        if (detections.landmarks && detections.landmarks.length > 0) {
            for (const landmarks of detections.landmarks) {
                drawHandLandmarks(canvasCtx, landmarks); // Visualizar (Paso 5a)
                applyHeuristics(landmarks); // Detectar eventos (Paso 5b)
            }
        }
        lastDetectionTime = now;

    }
    requestAnimationFrame(predictWebcam);
}

// --- HEURÍSTICAS (Paso 5: Utilizar los resultados) ---

function applyHeuristics(landmarks) {
    // A. Detectar Puño Cerrado
    const fist = isFist(landmarks);
    gestureText.innerText = fist ? "PUÑO CERRADO" : "MANO ABIERTA";
    gestureText.className = fist ? "gesture-active" : "";

    // B. Calcular Normal de la Palma
    const normal = calculatePalmNormal(landmarks);
    normalText.innerText = `${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)}`;

    // C. Calcular Ángulo (Articulación del Índice)
    // Puntos: A(Landmark 5), B(Landmark 6), C(Landmark 7)
    const angle = getAngleBetweenPoints(landmarks[5], landmarks[6], landmarks[7]);
    angleText.innerText = Math.round(angle);
}


function isFist(landmarks) {
    const wrist = landmarks[0];
    const fingertipIndices = [4, 8, 12, 16, 20];
    let closedCount = 0;

    fingertipIndices.forEach(i => {
        const fingertip = landmarks[i];
        const distance = Math.sqrt(
            Math.pow(fingertip.x - wrist.x, 2) +
            Math.pow(fingertip.y - wrist.y, 2) +
            Math.pow(fingertip.z - wrist.z, 2)
        );
        if (distance < 0.2) closedCount++;
    });
    return closedCount >= 4;
}

function calculatePalmNormal(landmarks) {
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];

    const v1 = { x: indexMCP.x - wrist.x, y: indexMCP.y - wrist.y, z: indexMCP.z - wrist.z };
    const v2 = { x: pinkyMCP.x - wrist.x, y: pinkyMCP.y - wrist.y, z: pinkyMCP.z - wrist.z };

    // Producto cruzado
    const normal = {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
    return normal;
}

function getAngleBetweenPoints(a, b, c) {
    const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
    const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

    const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosTheta) * (180 / Math.PI);
}

// Función de dibujo básica (Simplificación de Paso 5a)
function drawHandLandmarks(context, landmarks) {
    if (!landmarks) return;

    // 1. Dibujar las CONEXIONES (Líneas azules)
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Pulgar
        [0, 5], [5, 6], [6, 7], [7, 8], // Índice
        [0, 9], [9, 10], [10, 11], [11, 12], // Medio
        [0, 13], [13, 14], [14, 15], [15, 16], // Anular
        [0, 17], [17, 18], [18, 19], [19, 20], // Meñique
    ];

    connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        context.beginPath();
        context.moveTo(startPoint.x * 640, startPoint.y * 480);
        context.lineTo(endPoint.x * 640, endPoint.y * 480);
        context.lineWidth = 2;
        context.strokeStyle = "blue";
        context.stroke();
    });

    // 2. Dibujar los LANDMARKS (Puntos rojos)
    // Iteramos por cada punto detectado
    landmarks.forEach((point) => {
        context.beginPath();
        // Creamos un arco circular: (x, y, radio, ángulo_inicio, ángulo_fin)
        context.arc(
            point.x * 640,
            point.y * 480,
            4,      // Radio del punto
            0,
            2 * Math.PI
        );
        context.fillStyle = "red"; // Color rojo solicitado
        context.fill();
    });
}

createHandLandmarker();