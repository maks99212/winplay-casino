/* ============================================================
   db.js — общая шина данных на Firebase.
   ============================================================ */

// Ваш конфиг из Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA6fxM4YEwlgt8uvTMUAbPkiEWNjpYtIVw",
    authDomain: "winplay-admin.firebaseapp.com",
    databaseURL: "https://winplay-admin-default-rtdb.firebaseio.com",
    projectId: "winplay-admin",
    storageBucket: "winplay-admin.firebasestorage.app",
    messagingSenderId: "529132564995",
    appId: "1:529132564995:web:2d6a0777a01d045e529436",
    measurementId: "G-REZ65831P6"
};

// Инициализация
if (!window._fbInited) {
    firebase.initializeApp(firebaseConfig);
    window._fbInited = true;
}
const _db = firebase.database();
const DATA_REF = _db.ref('winplay_data');

// Локальный кэш — чтобы load() оставался СИНХРОННЫМ
let _cache = {};
let _ready = false;
const _listeners = {};

// ---------- REAL-TIME ПОДПИСКА ----------
DATA_REF.on('value', (snap) => {
    const prev = _cache;
    _cache = snap.val() || {};
    _ready = true;

    Object.keys(_listeners).forEach(key => {
        if (JSON.stringify(prev[key]) !== JSON.stringify(_cache[key])) {
            _listeners[key].forEach(cb => {
                try { cb(_cache[key]); } catch (e) { console.error('listener:', e); }
            });
        }
    });

    window.dispatchEvent(new CustomEvent('db-ready', { detail: _cache }));
});

// ---------- API, СОВМЕСТИМОЕ С БЫВШИМ localStorage ----------

function load(key, defaultValue) {
    const v = _cache[key];
    return v !== undefined ? v : defaultValue;
}

function save(key, value) {
    _cache[key] = value;
    DATA_REF.child(key).set(value).catch(e => console.error('save:', key, e));
}

function setField(key, path, value) {
    const segments = [key, ...String(path).split('/')];
    let obj = _cache;
    for (let i = 0; i < segments.length - 1; i++) {
        const s = segments[i];
        if (!obj[s] || typeof obj[s] !== 'object') obj[s] = {};
        obj = obj[s];
    }
    obj[segments[segments.length - 1]] = value;
    DATA_REF.child(key + '/' + path).set(value).catch(e => console.error('setField:', e));
}

function onChange(key, cb) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(cb);
    if (_ready) { try { cb(_cache[key]); } catch (e) {} }
}

function onAnyChange(cb) {
    DATA_REF.on('value', (snap) => {
        try { cb(snap.val() || {}); } catch (e) { console.error(e); }
    });
}

function waitForDb() {
    if (_ready) return Promise.resolve(_cache);
    return new Promise(resolve => {
        const h = (e) => { window.removeEventListener('db-ready', h); resolve(e.detail); };
        window.addEventListener('db-ready', h);
    });
}

async function nextUserId() {
    const r = _db.ref('winplay_data/__counters/userId');
    const res = await r.transaction(cur => (cur || 1000) + 1);
    return res.snapshot.val();
}
async function nextRequestId() {
    const r = _db.ref('winplay_data/__counters/reqId');
    const res = await r.transaction(cur => (cur || 0) + 1);
    return 'req_' + res.snapshot.val();
}
