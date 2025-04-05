// firebase-config.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDVNHHHN4UtYA8uQaL1n4oCWcI9_6E1gJ8",
  authDomain: "wattaware-718b3.firebaseapp.com",
  projectId: "wattaware-718b3",
  storageBucket: "wattaware-718b3.appspot.com",
  messagingSenderId: "46958510191",
  appId: "1:46958510191:web:9b259ae97ee67083d5cd9a",
  measurementId: "G-XNLFX18H7L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
