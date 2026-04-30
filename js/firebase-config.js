// =====================================================================
// firebase-config.js
// Tenta usar Firebase Firestore. Se falhar por qualquer motivo,
// cai automaticamente para localStorage (offline/fallback).
// =====================================================================

const LS_KEY = 'embraps_coe_data';
let db = null;
let useFirebase = false;

(function initFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.warn('[COE] Firebase SDK não carregado — usando localStorage.');
            return;
        }
        // Evita inicializar duas vezes (hot-reload)
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: "AIzaSyDx1SZydHPaBfMWp0zJG9xwP558Chn0_Kw",
                authDomain: "embraps-coe-dashboard.firebaseapp.com",
                projectId: "embraps-coe-dashboard",
                storageBucket: "embraps-coe-dashboard.firebasestorage.app",
                messagingSenderId: "1022634528388",
                appId: "1:1022634528388:web:6d5a960d6040c4fe467cd1"
            });
        }
        db = firebase.firestore();
        useFirebase = true;
        console.log('[COE] Firebase conectado com sucesso ✅');
    } catch (err) {
        console.warn('[COE] Firebase falhou — usando localStorage como fallback.', err.message);
        useFirebase = false;
    }
})();

// ---------- Helpers localStorage ----------

function _lsGetAll() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch { return {}; }
}
function _lsSetAll(data) {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ---------- Funções públicas (async) ----------

async function getAllData() {
    if (useFirebase && db) {
        try {
            const snapshot = await db.collection('indicadores').get();
            const data = {};
            snapshot.forEach(doc => { data[doc.id] = doc.data(); });
            return data;
        } catch (err) {
            console.warn('[COE] Firestore getAllData falhou — usando localStorage.', err.message);
        }
    }
    return _lsGetAll();
}

async function getDataByMonth(year, month) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (useFirebase && db) {
        try {
            const doc = await db.collection('indicadores').doc(key).get();
            return doc.exists ? doc.data() : null;
        } catch (err) {
            console.warn('[COE] Firestore getDataByMonth falhou — usando localStorage.', err.message);
        }
    }
    const all = _lsGetAll();
    return all[key] || null;
}

async function saveData(year, month, payload) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (useFirebase && db) {
        try {
            await db.collection('indicadores').doc(key).set(payload);
            // Atualiza localStorage em sincronia para uso offline
            const all = _lsGetAll();
            all[key] = payload;
            _lsSetAll(all);
            return;
        } catch (err) {
            console.warn('[COE] Firestore saveData falhou — salvando apenas em localStorage.', err.message);
        }
    }
    const all = _lsGetAll();
    all[key] = payload;
    _lsSetAll(all);
}

async function deleteData(year, month) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (useFirebase && db) {
        try {
            await db.collection('indicadores').doc(key).delete();
        } catch (err) {
            console.warn('[COE] Firestore deleteData falhou.', err.message);
        }
    }
    const all = _lsGetAll();
    delete all[key];
    _lsSetAll(all);
    return true;
}
