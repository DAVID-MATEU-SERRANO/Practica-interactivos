const touches = [];

function removeTouch(touchId) {
    const idx = touches.findIndex(touch => touch.id === touchId);
    if (idx !== -1) {
        touches.splice(idx, 1);
        const touchEl = document.querySelector(`#touch-${touchId}`);
        if (touchEl) touchEl.remove();
    }
}

function addTouch(touch) {
    touches.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
    });

    const touchEl = document.createElement("div");
    touchEl.id = `touch-${touch.identifier}`;
    touchEl.classList.add("touch-point");
    document.body.appendChild(touchEl);
}

// Evento cuando se pone un dedo en la pantalla
document.addEventListener("touchstart", function (e) {
    // Usamos changedTouches para obtener solo los dedos que acaban de tocar
    console.log(e);
    for (let i = 0; i < e.changedTouches.length; i++) {
        addTouch(e.changedTouches[i]);
    }
}, { passive: false });

// Evento cuando se levanta un dedo
document.addEventListener("touchend", function (e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
        removeTouch(e.changedTouches[i].identifier);
    }
});

// Evento cuando se arrastra el dedo
document.addEventListener("touchmove", function (e) {
    e.preventDefault(); // Evita que la pantalla se mueva (haga scroll)
    const changedTouches = e.changedTouches;
    for (let ct of changedTouches) {
        const idx = touches.findIndex(touch => touch.id === ct.identifier);
        if (idx !== -1) {
            const t = touches[idx];
            t.x = ct.clientX;
            t.y = ct.clientY;
        }
    }
}, { passive: false });

// Bucle de renderizado para suavidad visual
function onFrame() {
    touches.forEach(touch => {
        const touchPoint = document.querySelector(`#touch-${touch.id}`);
        if (touchPoint) {
            // Centramos el círculo (restamos la mitad de su ancho/alto, aprox 40px + borde)
            touchPoint.style.top = `${touch.y - 43}px`;
            touchPoint.style.left = `${touch.x - 43}px`;
        }
    });

    requestAnimationFrame(onFrame);
}

requestAnimationFrame(onFrame);