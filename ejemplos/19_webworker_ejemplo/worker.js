self.onmessage = function (event) {
    const limit = event.data;
    let sum = 0;

    // Intensive computation (summation)
    for (let i = 0; i < limit; i++) {
        sum += i;
    }

    // Send the result back to the main thread
    self.postMessage(sum);
};
