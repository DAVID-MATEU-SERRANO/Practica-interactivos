// Compatibilidad para navegadores (Chrome usa webkitSpeechRecognition)
const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
const SpeechGrammarList = window.webkitSpeechGrammarList || window.SpeechGrammarList;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    const speechRecognitionList = new SpeechGrammarList();

    // Definición de colores y gramática JSGF según tu imagen
    const colors = {
        'rojo': '#ff0000',
        'verde': '#00ff00',
        'amarillo': '#ffff00'
    };
    const grammar = '#JSGF V1.0; grammar colors; public <color> = ' + Object.keys(colors).join(' | ') + ' ;';

    // Configuración del reconocimiento
    speechRecognitionList.addFromString(grammar, 1);
    recognition.grammars = speechRecognitionList;
    recognition.continuous = false; // Solo una frase por activación
    recognition.lang = 'es-ES';     // Idioma español
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const startBtn = document.getElementById('startBtn');
    const status = document.getElementById('status');

    startBtn.onclick = () => {
        recognition.start();
        status.innerText = "Escuchando...";
    };

    // Procesamiento del resultado
    recognition.onresult = (event) => {
        // Accedemos al resultado mediante índices como si fuera un Array
        const result = event.results[0][0].transcript.toLowerCase();
        const confidence = event.results[0][0].confidence;

        console.log(`Resultado: ${result}`);
        console.log(`Confianza: ${confidence.toFixed(2)}`);
        status.innerText = `Has dicho: ${result}`;

        // Cambiamos el color si el resultado coincide con nuestro diccionario
        if (colors[result]) {
            document.body.style.backgroundColor = colors[result];
        } else {
            status.innerText = "Color no reconocido.";
        }
    };

    recognition.onspeechend = () => {
        recognition.stop();
    };

    recognition.onerror = (event) => {
        status.innerText = "Error en el reconocimiento: " + event.error;
    };

} else {
    alert("Tu navegador no soporta la Web Speech API. Prueba con Google Chrome.");
}