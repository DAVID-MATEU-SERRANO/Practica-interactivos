const btn = document.querySelector('#btn');
btn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        console.log(data);
    } catch (err) {
        console.log(err);
    }

});