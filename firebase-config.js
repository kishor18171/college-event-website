// Import the functions you need from the SDKs you need
// (Compat libraries are already loaded in HTML)

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUct1BRu4sHeVBngZORP7RKJLlhzlZCpo",
  authDomain: "college-event-website-78bc5.firebaseapp.com",
  projectId: "college-event-website-78bc5",
  storageBucket: "college-event-website-78bc5.firebasestorage.app",
  messagingSenderId: "756270821663",
  appId: "1:756270821663:web:a957ff7f8355c1c8ec002a",
  measurementId: "G-TJ4SFB7LL5"
};

// Initialize Firebase using the compat API so existing code doesn't break
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log("Firebase initialized");
