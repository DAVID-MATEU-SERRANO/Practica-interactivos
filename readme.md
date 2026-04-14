# Guía de ejecución del proyecto de tenis inteligente

Descripción del proyecto: 

## Requisitos Previos

Antes de empezar, asegúrate de tener instalado:
* **Node.js** (versión LTS recomendada)

Para verificar si tienes Node.js instalado, abre tu terminal (**PowerShell** o **CMD** en Windows; **Terminal** en Linux) y escribe el siguiente comando:

```bash
node -v
```

* **Si está instalado:** Verás un número de versión.
* **Si NO está instalado:** Verás un error tipo *"command not found"* o *"node no se reconoce como un comando"*. Si no lo tienes instalado, puedes descargarlo desde [nodejs.org](https://nodejs.org/es/download).

---

## Instalación y Puesta en Marcha

### 1. Clonar o descargar el proyecto
Si usas Git, clona el repositorio. Si no puedes decargar el proyecto desde el repositorio, puedes descargarlo en .zip.

### 2. Instalar las dependencias
Abre una terminal en la ruta del proyecto y ejecuta el siguiente comando para reconstruir la carpeta `node_modules`:

```bash
npm install
```
> **Nota:** Este comando leerá el archivo `package.json` y descargará automáticamente todas las librerías necesarias (Express, Socket.io, etc.). Es muy importante que la terminal esté en la misma carpeta que el archivo `package.json`.

### 3. Iniciar el servidor
Una vez que las dependencias se hayan instalado correctamente, lanza la aplicación con:

```bash
npm start
```

Si todo ha ido bien, verás un mensaje en la consola indicando que el servidor está corriendo (por ejemplo: `Servidor corriendo en http://localhost:3000`).

### 4. Conectar el teléfono 

Cuando abras la web http://localhost:3000 en el portátil tras darle al "Iniciar Sistema", se te mostrará un código QR. Escanea ese código QR con tu teléfono y se abrirá la web en tu teléfono. 

> [!CAUTION] Asegúrate de que el teléfono y el portátil estén conectados a la misma red Wi-Fi. Si no es así, no podrás conectar el teléfono al servidor. También vas a tener que darle permisos a la cámara y el micrófono de tu teléfono para que pueda detectar los gestos. Y en chrome://flags/#unsafely-treat-insecure-origin-as-secure tienes que pegar la ip del teléfono para que chrome permita el uso de la cámara y el micrófono en conexiones no seguras.

### 5. Iniciar el telefono

Una vez hecho el paso 4, en el teléfono se abrirá la web. Tras pulsar en el botón "Conectar sensores" en el teléfono, se empezará a reconocer los gestos y la voz. 

---

## Tecnologías utilizadas

* **Node.js**: Entorno de ejecución para JavaScript.
* **Express.js**: Framework web para Node.
* **Socket.io**: Librería para comunicación bidireccional en tiempo real entre cliente y servidor.

## Estructura del Proyecto

* `index.js` (o `app.js`): Punto de entrada del servidor.
* `public/`: Archivos estáticos (HTML, CSS, JS del cliente).
* `package.json`: Definición del proyecto y sus dependencias.

---

**¡Listo!** Ya puedes empezar a disfrutar del proyecto.