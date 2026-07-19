import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Одноразовая очистка перемешанных списков слов, оставшихся ДО разделения по
// языковым парам (тестовые данные, в которых немецкие и греческие слова попали
// в одну пару). Разделить их постфактум нельзя, поэтому очищаем один раз (по
// флагу). Настройки (язык/тема/уровень) НЕ трогаем. После этого каждое новое
// слово привязывается к своей паре и не смешивается.
function cleanupLegacyMixedWords() {
  try {
    const FLAG = 'wordsCleanupV1'
    if (localStorage.getItem(FLAG)) return
    // Перемешанный дамп жил в этих ключах — убираем его.
    localStorage.removeItem('wordsByPair')
    localStorage.removeItem('cardsByPair')
    // Старые «плоские» ключи (если где-то остались) — тоже.
    localStorage.removeItem('takenWords')
    localStorage.removeItem('knownWords')
    localStorage.removeItem('skippedWords')
    localStorage.removeItem('wordInfo')
    localStorage.removeItem('cardsBatch')
    localStorage.setItem(FLAG, '1')
  } catch {
    // localStorage недоступен — не критично
  }
}
cleanupLegacyMixedWords()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Регистрация service worker для PWA (устанавливаемость на телефон).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // регистрация не критична — приложение работает и без неё
    })
  })
}
