// Configuración - Cambia la URL al dominio donde despliegues tu Worker
const API_BASE_URL = 'https://tu-worker-url.workers.dev'; // ¡CAMBIA ESTO CON TU URL DE WORKER!

// Elementos DOM
const csvFileInput = document.getElementById('csvFile');
const fileNameDisplay = document.getElementById('file-name');
const playlistForm = document.getElementById('playlist-form');
const previewSection = document.getElementById('preview-section');
const songCountSpan = document.getElementById('song-count');
const previewBody = document.getElementById('preview-body');
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const resultMessage = document.getElementById('result-message');

// Variables globales
let parsedSongs = [];
let accessToken = null;

// Verificar si hay un token en la URL (después de la autenticación)
window.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    accessToken = urlParams.get('token');
    
    if (accessToken) {
        // Limpiar el token de la URL para seguridad
        window.history.replaceState({}, document.title, window.location.pathname);
        showSuccess('¡Autenticación exitosa! Ahora puedes crear tu playlist.');
    }

    // También verificar si hay un código de autorización
    const authCode = urlParams.get('auth_code');
    if (authCode) {
        window.history.replaceState({}, document.title, window.location.pathname);
        exchangeCodeForToken(authCode);
    }
});

// Eventos
csvFileInput.addEventListener('change', handleFileUpload);
createPlaylistBtn.addEventListener('click', handleCreatePlaylist);

// Funciones
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    fileNameDisplay.textContent = `Archivo seleccionado: ${file.name}`;
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            console.log("Archivo CSV parseado:", results);
            
            if (results.data && results.data.length > 0) {
                parsedSongs = results.data.map(row => {
                    // Intentar encontrar las columnas correctas
                    const artist = row.Artista || row.artista || row.ARTISTA || row.Artist || row.artist || 
                                  Object.values(row)[0];
                    const title = row.Título || row.título || row.Titulo || row.titulo || row.Title || 
                                 row.title || row.TITLE || Object.values(row)[1];
                    
                    return { artist, title };
                }).filter(song => song.artist && song.title);
                
                // Mostrar la vista previa
                displayPreview(parsedSongs);
            } else {
                showError("No se encontraron datos en el archivo CSV o el formato es incorrecto.");
            }
        },
        error: function(error) {
            console.error("Error al parsear el archivo CSV:", error);
            showError("Error al leer el archivo. Asegúrate de que sea un CSV válido.");
        }
    });
}

function displayPreview(songs) {
    songCountSpan.textContent = songs.length;
    previewBody.innerHTML = '';
    
    songs.forEach((song, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${song.artist}</td>
            <td>${song.title}</td>
        `;
        previewBody.appendChild(row);
    });
    
    playlistForm.classList.remove('hidden');
    previewSection.classList.remove('hidden');
}

function exchangeCodeForToken(authCode) {
    showMessage("Procesando autorización...", "info");
    
    fetch(`${API_BASE_URL}/callback?code=${authCode}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            if (data.token) {
                accessToken = data.token;
                showSuccess('¡Autorización exitosa! Ahora puedes crear tu playlist.');
            } else {
                throw new Error('No se pudo obtener el token de acceso');
            }
        })
        .catch(error => {
            console.error('Error al intercambiar código por token:', error);
            showError('Error al procesar la autorización. Por favor, intenta nuevamente.');
        });
}

function handleCreatePlaylist() {
    const playlistName = document.getElementById('playlist-name').value || "Mi Playlist";
    const playlistDescription = document.getElementById('playlist-description').value || "";
    
    if (!parsedSongs || parsedSongs.length === 0) {
        showError('No hay canciones para agregar a la playlist. Por favor, sube un archivo CSV válido.');
        return;
    }
    
    if (accessToken) {
        // Si ya tenemos el token, crear la playlist directamente
        createPlaylistWithToken(playlistName, playlistDescription, parsedSongs);
    } else {
        // Si no tenemos token, iniciar el proceso de autorización
        window.location.href = `${API_BASE_URL}/auth`;
    }
}

function createPlaylistWithToken(playlistName, playlistDescription, songs) {
    showMessage("Creando playlist en YouTube Music...", "info");
    createPlaylistBtn.disabled = true;
    createPlaylistBtn.textContent = "Procesando...";
    
    fetch(`${API_BASE_URL}/create-playlist`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token: accessToken,
            playlistName: playlistName,
            playlistDescription: playlistDescription,
            songs: songs
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            const successMessage = `
                <h3>¡Playlist creada con éxito!</h3>
                <p>Se ha creado la playlist "${playlistName}" con ${data.stats.added} canciones.</p>
                <p>Se encontraron ${data.stats.total} canciones en tu archivo, de las cuales ${data.stats.failed} no pudieron ser agregadas.</p>
                <p><a href="${data.playlistUrl}" target="_blank">Ver mi playlist en YouTube Music</a></p>
            `;
            showSuccess(successMessage);
        } else {
            throw new Error(data.error || 'Error desconocido al crear la playlist');
        }
    })
    .catch(error => {
        console.error('Error al crear playlist:', error);
        showError(`Error al crear la playlist: ${error.message}`);
    })
    .finally(() => {
        createPlaylistBtn.disabled = false;
        createPlaylistBtn.textContent = "Crear Playlist en YouTube Music";
    });
}

function showMessage(message, type) {
    resultMessage.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    resultMessage.classList.remove('hidden');
    // Desplazar hacia el mensaje
    resultMessage.scrollIntoView({ behavior: 'smooth' });
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showError(message) {
    showMessage(message, 'error');
}
