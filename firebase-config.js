// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAMMN1No3naog7jaGNqtybtsBg5boU0FVU",
  authDomain: "pulse-litfinder.firebaseapp.com",
  projectId: "pulse-litfinder",
  storageBucket: "pulse-litfinder.firebasestorage.app",
  messagingSenderId: "956030674762",
  appId: "1:956030674762:web:d6aa98ae07ccf1609183b3",
  measurementId: "G-9G96JZG67B"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
