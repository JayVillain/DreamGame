// =======================================================
// Global DOM Elements & Game State Variables
// =======================================================
const gameContainer = document.getElementById('game-container');
const backgroundElement = document.getElementById('background');
const charactersElement = document.getElementById('characters');
const dialogueBox = document.getElementById('dialogue-box');
const characterNameElement = document.getElementById('character-name');
const dialogueTextElement = document.getElementById('dialogue-text');
const nextButton = document.getElementById('next-button');
const loadingScreen = document.getElementById('loading-screen');
const choicesContainer = document.getElementById('choices-container'); // Akan digunakan di masa depan

let gameData = null; // Akan diisi dari dialogue.json
let currentChapterIndex = 0;
let currentSceneIndex = 0;
let currentEventIndex = 0;
let isTyping = false; // Flag untuk mencegah klik ganda saat teks sedang diketik
let currentTypeInterval = null; // Untuk menyimpan referensi interval typeText
let displayedCharacterSprite = null; // Melacak sprite karakter yang sedang ditampilkan

const TEXT_TYPING_SPEED = 30; // Kecepatan efek mengetik (ms per karakter)

// =======================================================
// Game Initialization & Asset Loading
// =======================================================

/**
 * Memuat semua aset yang diperlukan (gambar) sebelum game dimulai.
 * Ini memastikan tidak ada gambar yang hilang saat ditampilkan.
 * @returns {Promise<void>} Promise yang akan di-resolve setelah semua aset dimuat.
 */
async function preloadAssets() {
    const assetsToLoad = [];

    // Backgrounds (ambil dari data dialog untuk efisiensi, atau list manual jika ingin semua dimuat)
    if (gameData) { // Pastikan gameData sudah dimuat
        gameData.forEach(chapter => {
            chapter.scenes.forEach(scene => {
                const bgPath = `assets/backgrounds/${scene.background}`;
                if (scene.background && !assetsToLoad.includes(bgPath)) {
                    assetsToLoad.push(bgPath);
                }
            });
        });
    }

    // Characters (sesuai yang kita sepakati: gracia_normal, alex_normal, teacher_normal)
    assetsToLoad.push('assets/characters/gracia_normal.png');
    assetsToLoad.push('assets/characters/alex_normal.png');
    assetsToLoad.push('assets/characters/teacher_normal.png');
    
    // Misc assets (surat Alex, Alex ending)
    assetsToLoad.push('assets/misc/alex_letter.png');
    assetsToLoad.push('assets/misc/alex_ending.png');

    // Buat array of Promises untuk setiap gambar
    const imagePromises = assetsToLoad.map(src => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve();
            img.onerror = () => {
                console.warn(`[Asset Load Error] Gagal memuat aset: ${src}`);
                resolve(); // Tetap resolve agar game bisa lanjut, tapi berikan warning
            };
        });
    });

    console.log(`[Game Init] Memuat ${assetsToLoad.length} aset...`);
    await Promise.all(imagePromises); // Tunggu semua gambar selesai dimuat
    console.log("[Game Init] Semua aset berhasil dimuat.");
}

/**
 * Mengambil data cerita dari file dialogue.json.
 * @returns {Promise<Array>} Data cerita dari JSON.
 */
async function fetchGameData() {
    try {
        const response = await fetch('data/dialogue.json');
        if (!response.ok) {
            throw new Error(`[Fetch Error] HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('[Fetch Error] Gagal memuat data game:', error);
        loadingScreen.textContent = "Gagal memuat game. Silakan refresh halaman.";
        throw error; // Lempar error agar startGame bisa menangkapnya
    }
}

/**
 * Fungsi utama untuk memulai game.
 */
async function startGame() {
    console.log("[Game Init] Memulai game...");
    try {
        gameData = await fetchGameData();
        await preloadAssets(); // Preload setelah gameData tersedia
        loadingScreen.style.display = 'none'; // Sembunyikan layar loading

        // Pastikan ada data untuk dimainkan
        if (!gameData || gameData.length === 0) {
            gameContainer.innerHTML = "<p style='color: white; text-align: center; font-size: 1.5em;'>Error: Data cerita kosong atau tidak valid.</p>";
            return;
        }

        displayCurrentEvent(); // Mulai tampilkan event pertama
        console.log("[Game Init] Game siap dimainkan!");
    } catch (error) {
        console.error("[Game Error] Kesalahan fatal saat memulai game:", error);
        gameContainer.innerHTML = `<p style='color: white; text-align: center; font-size: 1.5em;'>Terjadi kesalahan fatal. Silakan coba lagi. (${error.message})</p>`;
    }
}

// =======================================================
// Display Logic (Background, Characters, Dialogue)
// =======================================================

/**
 * Mengubah latar belakang adegan dengan transisi fade.
 * @param {string} imageName Nama file gambar latar belakang (misal: 'gracia_bedroom_day.jpg').
 */
function setBackground(imageName) {
    const newBackgroundUrl = `url('assets/backgrounds/${imageName}')`;
    if (backgroundElement.style.backgroundImage === newBackgroundUrl) {
        backgroundElement.style.opacity = 1; // Jika sama, pastikan opacity 1
        return; // Tidak perlu transisi jika latar belakang tidak berubah
    }

    backgroundElement.style.opacity = 0; // Mulai dengan opacity 0 untuk transisi keluar
    setTimeout(() => {
        backgroundElement.style.backgroundImage = newBackgroundUrl;
        backgroundElement.style.opacity = 1; // Transisi masuk
    }, 500); // Setengah dari waktu transisi CSS untuk fade-out
}

/**
 * Menampilkan sprite karakter di layar.
 * Hanya menampilkan satu karakter. Jika karakter yang ditampilkan berbeda, ganti.
 * Jika karakter yang sama, pastikan dia visible.
 * @param {string} characterName Nama karakter (misal: 'Gracia', 'Alex').
 * @param {string} expression Ekspresi karakter (misal: 'normal').
 */
function showCharacter(characterName, expression = 'normal') {
    const characterId = `char-${characterName.toLowerCase()}`;
    let charImg = document.getElementById(characterId);

    // Jika karakter sudah ada dan sama, cukup pastikan dia terlihat
    if (charImg && displayedCharacterSprite === charImg) {
        charImg.style.opacity = 1;
        return;
    }

    // Hapus karakter yang sedang ditampilkan jika ada yang berbeda
    if (displayedCharacterSprite && displayedCharacterSprite !== charImg) {
        charactersElement.removeChild(displayedCharacterSprite);
        displayedCharacterSprite = null;
    }

    // Buat atau update karakter baru
    if (!charImg) {
        charImg = document.createElement('img');
        charImg.id = characterId;
        charImg.src = `assets/characters/${characterName.toLowerCase()}_${expression}.png`;
        charImg.alt = characterName;
        charImg.classList.add('character-sprite');
        charactersElement.appendChild(charImg);
    } else {
        // Jika charImg sudah ada tapi bukan yang terakhir ditampilkan (misal: disembunyikan), tambahkan lagi
        if (!charactersElement.contains(charImg)) {
            charactersElement.appendChild(charImg);
        }
        charImg.src = `assets/characters/${characterName.toLowerCase()}_${expression}.png`; // Update ekspresi jika diperlukan
    }
    
    // Pastikan karakter terlihat
    setTimeout(() => {
        charImg.style.opacity = 1; // Fade-in karakter
    }, 10); // Sedikit delay agar transisi bekerja
    
    displayedCharacterSprite = charImg;
    console.log(`[Display] Menampilkan karakter: ${characterName} (${expression})`);
}

/**
 * Menyembunyikan semua sprite karakter yang sedang ditampilkan.
 */
function hideCharacters() {
    if (displayedCharacterSprite) {
        displayedCharacterSprite.style.opacity = 0; // Fade-out
        setTimeout(() => {
            if (displayedCharacterSprite && !isTyping) { // Pastikan masih ada dan bukan karena klik cepat
                charactersElement.removeChild(displayedCharacterSprite);
                displayedCharacterSprite = null;
            }
        }, 500); // Sesuaikan dengan durasi transisi CSS
    }
    console.log("[Display] Karakter disembunyikan.");
}

/**
 * Menampilkan teks dialog dengan efek mengetik (typewriter effect).
 * @param {string} text Teks yang akan ditampilkan.
 * @returns {Promise<void>} Promise yang di-resolve setelah teks selesai diketik.
 */
function typeText(text) {
    if (currentTypeInterval) { // Hentikan interval sebelumnya jika ada
        clearInterval(currentTypeInterval);
    }
    isTyping = true;
    dialogueTextElement.textContent = ''; // Kosongkan teks sebelumnya
    let i = 0;
    return new Promise(resolve => {
        currentTypeInterval = setInterval(() => {
            if (i < text.length) {
                dialogueTextElement.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(currentTypeInterval);
                currentTypeInterval = null;
                isTyping = false;
                resolve();
            }
        }, TEXT_TYPING_SPEED);
    });
}

/**
 * Mengubah teks dialog menjadi langsung penuh (skip typewriter effect).
 */
function skipTyping() {
    if (isTyping && currentTypeInterval) {
        clearInterval(currentTypeInterval);
        currentTypeInterval = null;
        const currentEvent = getCurrentEvent();
        if (currentEvent && currentEvent.text) {
            dialogueTextElement.textContent = currentEvent.text;
        }
        isTyping = false;
        nextButton.disabled = false; // Pastikan tombol aktif setelah skip
    }
}

/**
 * Mengambil event saat ini dari gameData.
 * @returns {object|null} Objek event saat ini atau null jika tidak ada.
 */
function getCurrentEvent() {
    if (!gameData || !gameData[currentChapterIndex]) return null;
    const chapter = gameData[currentChapterIndex];
    if (!chapter.scenes || !chapter.scenes[currentSceneIndex]) return null;
    const scene = chapter.scenes[currentSceneIndex];
    if (!scene.events || !scene.events[currentEventIndex]) return null;
    return scene.events[currentEventIndex];
}

/**
 * Mengupdate tampilan UI berdasarkan event yang sedang berlangsung.
 */
async function displayCurrentEvent() {
    nextButton.disabled = true; // Nonaktifkan tombol saat transisi atau mengetik

    const chapter = gameData[currentChapterIndex];
    if (!chapter) {
        // Game berakhir
        console.log("[Game End] Game Berakhir!");
        displayEndingScreen();
        return;
    }

    const scene = chapter.scenes[currentSceneIndex];
    if (!scene) {
        console.error("[Display Error] Scene tidak ditemukan:", currentSceneIndex, "di chapter", currentChapterIndex);
        return;
    }

    const event = scene.events[currentEventIndex];
    if (!event) {
        console.error("[Display Error] Event tidak ditemukan:", currentEventIndex, "di scene", currentSceneIndex, "chapter", currentChapterIndex);
        return;
    }

    console.log(`[Display Event] Chapter ${currentChapterIndex+1}, Scene ${currentSceneIndex+1}, Event ${currentEventIndex+1}:`, event);

    // Pastikan kotak dialog terlihat jika sebelumnya tersembunyi
    dialogueBox.style.opacity = 1;

    // 1. Atur Latar Belakang
    if (scene.background) {
        setBackground(scene.background);
    }

    // 2. Kelola Event Khusus (display_image, hide_image)
    if (event.type === 'display_image') {
        const miscImg = document.createElement('img');
        miscImg.src = `assets/misc/${event.image}`;
        miscImg.style.position = 'absolute';
        miscImg.style.top = '50%';
        miscImg.style.left = '50%';
        miscImg.style.transform = 'translate(-50%, -50%)';
        miscImg.style.maxWidth = '60%';
        miscImg.style.maxHeight = '80%';
        miscImg.style.zIndex = '5'; // Di atas semua UI utama
        miscImg.style.border = '5px solid #fff';
        miscImg.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
        miscImg.id = 'current-misc-image'; // Beri ID untuk mudah dihapus
        gameContainer.appendChild(miscImg);

        characterNameElement.textContent = ''; // Tidak ada nama saat gambar full screen
        await typeText(event.text || ""); // Tampilkan teks opsional untuk gambar
        nextButton.disabled = false;
        return; // Jangan lanjutkan ke logika dialog biasa
    } else if (event.type === 'hide_image') {
        const existingMiscImg = document.getElementById('current-misc-image');
        if (existingMiscImg) {
            existingMiscImg.style.opacity = 0; // Fade out
            setTimeout(() => {
                existingMiscImg.parentNode.removeChild(existingMiscImg);
            }, 500); // Sesuaikan dengan durasi transisi
        }
        await typeText(event.text || ""); // Tampilkan teks opsional setelah menyembunyikan gambar
        nextButton.disabled = false;
        return;
    }

    // 3. Kelola Karakter dan Dialog
    if (event.type === 'character_dialogue') {
        characterNameElement.textContent = event.character;
        // Hanya tampilkan karakter jika ada yang berbicara
        showCharacter(event.character, 'normal'); // Sekarang hanya 'normal'
    } else { // Narasi
        characterNameElement.textContent = '';
        // Sembunyikan karakter jika event-nya narasi dan bukan bagian dari dialog karakter.
        // Asumsi: karakter hanya terlihat saat dialog. Jika ingin karakter tetap ada saat narasi di scene yang sama, logika ini bisa diubah.
        hideCharacters();
    }

    // Tampilkan teks dialog dengan efek mengetik
    await typeText(event.text);
    nextButton.disabled = false; // Aktifkan tombol lanjut setelah teks selesai diketik
}

/**
 * Menampilkan layar ending game.
 */
function displayEndingScreen() {
    // Pastikan semua elemen UI game disembunyikan/dihapus
    dialogueBox.style.display = 'none';
    charactersElement.innerHTML = ''; // Hapus semua karakter
    backgroundElement.style.opacity = 0; // Fade out background

    // Buat konten ending
    gameContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; height: 100%; background-color: rgba(0,0,0,0.95); color: white; font-size: 2em; text-align: center; position: absolute; top:0; left:0; z-index: 100;">
            <img src="assets/misc/alex_ending.png" alt="Alex di Akhir Cerita" style="max-width: 50%; height: auto; margin-bottom: 30px; border-radius: 10px; box-shadow: 0 0 30px rgba(255,255,255,0.2);">
            <h1 style="font-family: 'Playfair Display', serif; margin-bottom: 15px;">Mimpi yang Terwujud</h1>
            <p style="font-size: 0.8em; line-height: 1.5;">Terima kasih telah menemani Gracia dalam perjalanannya.<br>Mungkin ada beberapa mimpi yang memang ditakdirkan untuk menjadi nyata.</p>
            <button onclick="location.reload()" style="background-color: #555; color: white; border: none; padding: 12px 25px; font-size: 0.8em; cursor: pointer; border-radius: 8px; margin-top: 40px; transition: background-color 0.3s ease, transform 0.1s ease;">
                Main Lagi
            </button>
        </div>
    `;
}

// =======================================================
// Navigation Logic
// =======================================================

/**
 * Memajukan cerita ke event berikutnya, atau scene/chapter berikutnya jika diperlukan.
 */
function goToNextEvent() {
    if (isTyping) {
        skipTyping(); // Lewati efek mengetik jika sedang berjalan
        return;
    }

    currentEventIndex++;
    const currentChapter = gameData[currentChapterIndex];
    
    // Jika ada event berikutnya dalam scene yang sama
    if (currentEventIndex < currentChapter.scenes[currentSceneIndex].events.length) {
        displayCurrentEvent();
    }
    // Jika tidak ada event berikutnya, coba ke scene berikutnya
    else {
        currentSceneIndex++;
        currentEventIndex = 0; // Reset event index untuk scene baru
        
        // Jika ada scene berikutnya dalam chapter yang sama
        if (currentSceneIndex < currentChapter.scenes.length) {
            // Jika scene baru tidak punya background yang didefinisikan secara eksplisit, pakai background scene sebelumnya
            if (!currentChapter.scenes[currentSceneIndex].background) {
                currentChapter.scenes[currentSceneIndex].background = currentChapter.scenes[currentSceneIndex - 1].background;
            }
            displayCurrentEvent();
        }
        // Jika tidak ada scene berikutnya, coba ke chapter berikutnya
        else {
            currentChapterIndex++;
            currentSceneIndex = 0; // Reset scene index untuk chapter baru
            currentEventIndex = 0; // Reset event index untuk chapter baru
            hideCharacters(); // Sembunyikan karakter saat pindah chapter
            displayCurrentEvent(); // Panggil lagi untuk chapter baru (atau layar ending)
        }
    }
}

// =======================================================
// Event Listeners
// =======================================================

// Tambahkan event listener untuk tombol 'Lanjut'
nextButton.addEventListener('click', goToNextEvent);

// Tambahkan event listener untuk klik di kotak dialog (memajukan cerita atau skip typing)
dialogueBox.addEventListener('click', (event) => {
    // Pastikan klik bukan pada tombol 'Lanjut' itu sendiri
    if (event.target.id !== 'next-button') {
        goToNextEvent();
    }
});

// =======================================================
// Start Game on Page Load
// =======================================================
document.addEventListener('DOMContentLoaded', startGame);