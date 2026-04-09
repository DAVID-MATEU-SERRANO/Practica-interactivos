// URL del modelo exportado desde Teachable Machine
const URL = "https://teachablemachine.withgoogle.com/models/MjbF8E4RG/";

let model, webcam, labelContainer, maxPredictions;

// Inicialización del modelo y de la webcam
async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    // Carga el modelo y los metadatos
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    // Configuración de la webcam
    const flip = true; // si se debe girar la webcam
    webcam = new tmImage.Webcam(200, 200, flip); // width, height, flip
    await webcam.setup(); // solicita acceso a la webcam
    await webcam.play();

    // Inicia el bucle de renderizado
    window.requestAnimationFrame(loop);

    // Añade el elemento de la webcam al DOM
    document.getElementById("webcam-container").appendChild(webcam.canvas);

    // Crea contenedores para las etiquetas de probabilidad
    labelContainer = document.getElementById("label-container");
    for (let i = 0; i < maxPredictions; i++) {
        labelContainer.appendChild(document.createElement("div"));
    }
}

// Función recursiva para realizar predicciones (Transparencia 13)
async function loop() {
    webcam.update(); // actualiza el frame de la webcam
    await predict();
    window.requestAnimationFrame(loop);
}

// Realiza la predicción y muestra resultados (Transparencia 13)
async function predict() {
    // El modelo puede predecir desde una imagen, video o canvas
    const prediction = await model.predict(webcam.canvas);

    for (let i = 0; i < maxPredictions; i++) {
        // Formatea el nombre de la clase y la probabilidad
        const classPrediction =
            prediction[i].className + ": " + prediction[i].probability.toFixed(2);

        labelContainer.childNodes[i].innerHTML = classPrediction;
    }
}