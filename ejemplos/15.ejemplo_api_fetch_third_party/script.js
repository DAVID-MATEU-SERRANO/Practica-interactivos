async function getRandomJoke() {
    // fetch('https://api.chucknorris.io/jokes/random')
    //     .then(response => response.json())
    //     .then(data => {
    //         console.log(data);
    //         document.querySelector('#joke').textContent = data.value;
    //     })
    //     .catch(error => console.log(error));
    try {
        const response = await fetch('https://api.chucknorris.io/jokes/random');
        const joke = await response.json();

    } catch (error) {
        console.log(error);
    }
}

document.querySelector('#get_joke').addEventListener('click', getRandomJoke);
