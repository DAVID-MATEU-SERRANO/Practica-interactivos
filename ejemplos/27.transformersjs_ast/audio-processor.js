class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(16384);
        this.pointer = 0;
    }

    process(inputs) {
        const input = inputs[0][0]; // Obtenemos canal 0
        if (!input) return true;

        for (let i = 0; i < input.length; i++) {
            this.buffer[this.pointer++] = input[i];

            if (this.pointer >= this.buffer.length) {
                // Enviamos el buffer lleno y reiniciamos
                this.port.postMessage(this.buffer);
                this.buffer = new Float32Array(16384);
                this.pointer = 0;
            }
        }
        return true;
    }
}
registerProcessor('audio-processor', AudioProcessor);