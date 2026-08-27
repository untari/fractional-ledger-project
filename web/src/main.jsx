// wrapper that surfaces potential React problems during development
import { StrictMode } from 'react'
// the React 18+ way to attach an app to the DOM
import { createRoot } from 'react-dom/client'
// global styles (bundled by Vite at build time, not a runtime import)
import './index.css'
// the root component
import App from './App.jsx'

// find <div id="root"> in index.html and render the app into it
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
