// Configuración de umbrales según tu código
const items = document.querySelectorAll("li");

const TIME_THRESHOLD = 200;  // Tiempo máximo en ms para que sea un swipe rápido
const SPACE_THRESHOLD = 100; // Distancia mínima en píxeles recorrida

let startX = 0;
let startTime = 0;



items.forEach(item => {
    // 1. Detectamos el inicio del toque
    item.addEventListener("touchstart", e => {
        // e.preventDefault() evita el scroll mientras interactuamos
        e.preventDefault();
        item.classList.remove("swiped"); // Reiniciamos estado

        // Guardamos posición y tiempo inicial
        startX = e.targetTouches[0].screenX;
        startTime = e.timeStamp;
    }, { passive: false });

    // 2. Opcional: Actualizar posición durante el movimiento (no crítico para swipe básico)
    item.addEventListener("touchmove", e => {
        e.preventDefault();
    }, { passive: false });

    // 3. Al levantar el dedo, comprobamos si cumple las condiciones del gesto
    item.addEventListener("touchend", e => {
        e.preventDefault();

        const endTime = e.timeStamp;
        const endX = e.changedTouches[0].screenX; // Posición final

        // Lógica de detección:
        // Diferencia de tiempo < umbral Y diferencia de distancia > umbral
        const duration = endTime - startTime;
        const distance = endX - startX;

        if (duration < TIME_THRESHOLD && distance > SPACE_THRESHOLD) {
            handleSwipe(item);
        }
    });
});

function handleSwipe(target) {
    console.log("¡Swipe detectado!");
    target.classList.add("swiped");
    // Podrías añadir lógica aquí para borrar el elemento o marcarlo como completado
}