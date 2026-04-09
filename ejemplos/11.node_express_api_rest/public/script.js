// Referencias a los elementos del DOM
const userForm = document.querySelector('#userForm');
const userList = document.querySelector('#userList');

// Función para obtener y mostrar los usuarios
async function loadUsers() {
    const response = await fetch('/api/users');

    // fetch('/api/users')
    //     .then(response => response.json())
    //     .then(data => console.log(data));

    const users = await response.json();

    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = `${user.id}: ${user.name} (${user.email})`;
        userList.appendChild(li);
    });
}

// Evento para crear un usuario (POST)
userForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.querySelector('#name').value;
    const email = document.querySelector('#email').value;

    const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
    });

    if (response.ok) {
        userForm.reset();
        loadUsers(); // Recargar la lista tras crear
    }
});

// Evento para buscar por ID
document.querySelector('#searchBtn').addEventListener('click', async () => {
    const id = document.querySelector('#searchId').value;
    const resultDiv = document.querySelector('#searchResult');

    const response = await fetch(`/api/users/${id}`);
    if (response.ok) {
        const user = await response.json();
        resultDiv.innerHTML = `<p>Encontrado: ${user.name}</p>`;
    } else {
        resultDiv.innerHTML = `<p style="color:red;">User not found</p>`;
    }
});

// Carga inicial
loadUsers();