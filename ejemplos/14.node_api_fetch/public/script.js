(async function fetchData() {
    const response = await fetch('/mi/ruta');
    try {
        const data = await response.text();
        console.log(data);
    } catch (error) {
        console.log(error);
    }
})();


const promise = fetch('/mi/ruta');
promise.then(function (response) {
    if (response.ok) {
        response.text().then(function (data) {
            console.log(data);
        });
    }
})
    .catch(function (error) {
        console.log(error);
    });