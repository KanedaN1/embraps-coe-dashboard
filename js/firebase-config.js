// =====================================================================
// firebase-config.js — Inicialização do Firebase e funções de dados
// Substitui o localStorage pelas chamadas ao Firestore
// =====================================================================

const firebaseConfig = {
    apiKey: "AIzaSyDx1SZydHPaBfMWp0zJG9xwP558Chn0_Kw",
    authDomain: "embraps-coe-dashboard.firebaseapp.com",
    projectId: "embraps-coe-dashboard",
    storageBucket: "embraps-coe-dashboard.firebasestorage.app",
    messagingSenderId: "1022634528388",
    appId: "1:1022634528388:web:6d5a960d6040c4fe467cd1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const COLLECTION = 'indicadores';

// Retorna todos os dados do ano (objeto { "2026-04": {...}, ... })
async function getAllData() {
    try {
        const snapshot = await db.collection(COLLECTION).get();
        const data = {};
        snapshot.forEach(doc => {
            data[doc.id] = doc.data();
        });
        return data;
    } catch (err) {
        console.error('Erro ao buscar dados do Firestore:', err);
        return {};
    }
}

// Retorna os dados de um mês específico
async function getDataByMonth(year, month) {
    try {
        const key = `${year}-${month.padStart(2, '0')}`;
        const doc = await db.collection(COLLECTION).doc(key).get();
        return doc.exists ? doc.data() : null;
    } catch (err) {
        console.error('Erro ao buscar mês do Firestore:', err);
        return null;
    }
}

// Salva os dados de um mês no Firestore
async function saveData(year, month, payload) {
    try {
        const key = `${year}-${month.padStart(2, '0')}`;
        await db.collection(COLLECTION).doc(key).set(payload);
    } catch (err) {
        console.error('Erro ao salvar no Firestore:', err);
        throw err;
    }
}

// Exclui os dados de um mês no Firestore
async function deleteData(year, month) {
    try {
        const key = `${year}-${month.padStart(2, '0')}`;
        await db.collection(COLLECTION).doc(key).delete();
        return true;
    } catch (err) {
        console.error('Erro ao excluir do Firestore:', err);
        return false;
    }
}
