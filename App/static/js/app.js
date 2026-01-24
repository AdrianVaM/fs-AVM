let users = [];

class Item {
    constructor(name, password) {
        this.name = name;
        this.password = password;
    }
    getName() {
        return this.name;
    }
    getPassword() {
        return this.password;
    }
}

function newItem(event) {
    event.preventDefault();
    const nameInput = document.getElementById("name");
    const passwordInput = document.getElementById("password");
    const name = nameInput.value.trim();
    const password = passwordInput.value;
    if (name === "" || password === "") return;
    let new_elem = new Item(name, password);
    users.push(new_elem);
    nameInput.value = "";
    passwordInput.value = "";
    fetchItems();
}

function fetchItems() {
    const itemList = document.getElementById('itemList');
    if (!itemList) return;
    itemList.innerHTML = '';
    users.forEach((user) => {
        const li = document.createElement('li');
        li.className = 'container';
        li.style.position = 'relative';
        li.innerHTML = `
            <p class="bold">Usuario:</p>
            <p>${user.getName()}</p>
            <p class="bold">Contraseña:</p>
            <p class="censored">${user.getPassword()}</p>
        `;
        itemList.appendChild(li);
    });
}

document.getElementById("userForm").addEventListener("submit", newItem);