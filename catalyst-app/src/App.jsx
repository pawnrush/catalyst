import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import React, { useState, useEffect, useRef } from 'react';


// --- Firebase Configuration ---
// CRITICAL: Replace this with your actual Firebase config object from your Firebase project.
const firebaseConfig = {
  apiKey: "AIzaSyAbj9hbMWxNjqZVDb748WnYO6CulC8Le4g",
  authDomain: "catalyst-1070a.firebaseapp.com",
  projectId: "catalyst-1070a",
  storageBucket: "atalyst-1070a.firebasestorage.app",
  messagingSenderId: "846726638572",
  appId: "1:846726638572:web:93e287e463c0e4654beec9"
};

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
