import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyChqL_X444XhX6qPvrCvJrRyLtQxmBfwvc",
  authDomain: "vendasimigracao-b5a34.firebaseapp.com",
  databaseURL: "https://vendasimigracao-b5a34-default-rtdb.firebaseio.com",
  projectId: "vendasimigracao-b5a34",
  storageBucket: "vendasimigracao-b5a34.firebasestorage.app",
  messagingSenderId: "739933304098",
  appId: "1:739933304098:web:7a1f1722109bdbd8fc217b",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { database, auth };