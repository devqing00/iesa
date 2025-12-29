import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDroDIE2b61n27HtoB9wtkvCNTP28EjTlo",
  authDomain: "iesa-6509b.firebaseapp.com",
  projectId: "iesa-6509b",
  storageBucket: "iesa-6509b.firebasestorage.app",
  messagingSenderId: "299588079358",
  appId: "1:299588079358:web:f1d1c160d0cb9b27a85faf",
  measurementId: "G-B29JF8GZB8",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
