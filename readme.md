# Tenis Inteligente: Asistente Interactivo y Ubicuo para Tenistas Amateurs

## Autores
David Mateu Serrano (100522337)
Manuel Manchado Barquero (100522228)
Fran Jurado Basté (100522213)

## Descripción del Proyecto
Tenis Inteligente es un sistema interactivo ubicuo diseñado específicamente para tenistas amateurs que entrenan o juegan partidos sin la supervisión de un entrenador. El objetivo principal es proporcionar información relevante en tiempo real (marcador, estadísticas tácticas y *feedback* biomecánico) de forma completamente no intrusiva. 

Para resolver el problema de la interacción durante el juego, el sistema elimina la necesidad de contacto táctil o de soltar la raqueta. Toda la comunicación con el sistema se realiza a través de comandos de voz y el reconocimiento de gestos corporales.

## Arquitectura del Sistema
El proyecto opera sobre dos dispositivos físicos interconectados en tiempo real mediante un servidor central:

1.  **Controlador (Teléfono Móvil):** Insertado en la raqueta o en una posición estática (dependiendo del modo), actúa como el sensor principal. Captura datos inerciales (acelerómetro y giroscopio), procesa audio para comandos de voz y captura imágenes para el análisis biomecánico.
2.  **Dashboard (Pantalla/Portátil en el banquillo):** Funciona como la interfaz visual y auditiva principal. Muestra el marcador, las estadísticas, el análisis de postura en tiempo real y emite avisos sonoros (puntuación, faltas, cambios de pista).
3.  **Servidor Central (Node.js):** Actúa como *broker* de eventos utilizando Socket.IO, gestionando la comunicación bidireccional entre el móvil y el dashboard, además de mantener el estado del partido y persistir las estadísticas.

## Modos de Funcionamiento

El sistema se divide en dos modos principales, seleccionables por voz:

### 1. Modo Partido
Orientado a la gestión autónoma del juego y el análisis táctico.
*   **Control de Marcador Gestual:** El jugador controla la puntuación (puntos, juegos, sets, *tie-breaks*) mediante giros de muñeca capturados por el giroscopio del móvil.
*   **Estadísticas Tácticas Automáticas:** Mediante el análisis del acelerómetro, el sistema registra cada golpe, su potencia, tipo de trayectoria estimada y clasifica la zona de impacto (derecha/revés).
*   **Asistencia por Voz:** El dashboard anuncia automáticamente la puntuación tras cada punto y avisa de los cambios de pista.

### 2. Modo Entrenamiento
Utiliza la cámara del móvil y visión artificial para proporcionar *feedback* técnico. Consta de tres sub-modos:
*   **Fondo:** Analiza la posición del codo en golpes de fondo de pista utilizando MediaPipe, proponiendo desafíos de 5 golpes.
*   **Saque:** Evalúa la extensión del codo y la altura de la muñeca en el momento del impacto durante el servicio.
*   **Línea:** Detecta automáticamente faltas de pie (*foot faults*) en el saque mediante un modelo de clasificación de imágenes (Teachable Machine), emitiendo avisos sonoros instantáneos.

## Stack Tecnológico

*   **Backend:** Node.js, Express, Socket.IO (Comunicación bidireccional sobre WebSockets).
*   **Visión Artificial & Machine Learning:**
    *   MediaPipe Tasks Vision (Detección de *landmarks* corporales).
    *   TensorFlow.js / Teachable Machine (Clasificación de imágenes para detección de faltas).
*   **APIs Nativas Web:**
    *   Web Speech API (Reconocimiento y síntesis de voz).
    *   Sensor APIs (Acelerómetro y Giroscopio a 60 Hz).
*   **Frontend:** HTML5, CSS3, JavaScript (Canvas API para renderizado en tiempo real).


## Guía de ejecución del proyecto

### Requisitos Previos

Antes de empezar, asegúrate de tener instalado:
* **Node.js** (versión LTS recomendada)

Para verificar si tienes Node.js instalado, abre tu terminal (**PowerShell** o **CMD** en Windows; **Terminal** en Linux) y escribe el siguiente comando:

```bash
node -v
```

* **Si está instalado:** Verás un número de versión.
* **Si NO está instalado:** Verás un error tipo *"command not found"* o *"node no se reconoce como un comando"*. Si no lo tienes instalado, puedes descargarlo desde [nodejs.org](https://nodejs.org/es/download).

---

### Instalación y Puesta en Marcha

#### 1. Instalar las dependencias
Abre una terminal en la ruta del proyecto y ejecuta el siguiente comando para reconstruir la carpeta `node_modules`:

```bash
npm install
```
> **Nota:** Este comando leerá el archivo `package.json` y descargará automáticamente todas las librerías necesarias (Express, Socket.io, etc.). Es muy importante que la terminal esté en la misma carpeta que el archivo `package.json`.

#### 2. Iniciar el servidor
Una vez que las dependencias se hayan instalado correctamente, lanza la aplicación con:

```bash
npm start
```

Si todo ha ido bien, verás un mensaje en la consola indicando que el servidor está corriendo (`Servidor corriendo en http://localhost:3000`).

#### 3. Conectar el teléfono 

Cuando abras la web http://localhost:3000 en el portátil tras darle al "Iniciar Sistema", se te mostrará un código QR. Escanea ese código QR con tu teléfono y se abrirá la web en tu teléfono. 

> [!CAUTION] Asegúrate de que el teléfono y el portátil estén conectados a la misma red Wi-Fi. Si no es así, no podrás conectar el teléfono al servidor. También vas a tener que darle permisos a la cámara y el micrófono de tu teléfono para que pueda detectar los gestos. Y en chrome://flags/#unsafely-treat-insecure-origin-as-secure tienes que pegar la ip del teléfono para que chrome permita el uso de la cámara y el micrófono en conexiones no seguras.

#### 4. Iniciar el telefono

Una vez hecho el paso 4, en el teléfono se abrirá la web. Tras pulsar en el botón "Conectar sensores" en el teléfono, se empezará a reconocer los gestos y la voz. 
