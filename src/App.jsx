import { useState, useEffect, useCallback } from 'react'
import { getSettings } from './db.js'
import { Icon } from './components/ui.jsx'
import BatchList from './components/BatchList.jsx'
import BatchDetail from './components/BatchDetail.jsx'
import Settings from './components/Settings.jsx'

export default function App() {
  // view: { name: 'list' } | { name: 'batch', id } | { name: 'settings' }
  const [view, setView] = useState({ name: 'list' })
  const [settings, setSettings] = useState(null)

  const refreshSettings = useCallback(() => getSettings().then(setSettings), [])
  useEffect(() => {
    refreshSettings()
  }, [refreshSettings])

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <h1
            className="app-title"
            style={{ cursor: 'pointer' }}
            onClick={() => setView({ name: 'list' })}
          >
            <span className="logo"><Icon name="receipt" size={16} /></span>
            Strukin
          </h1>
          <div className="spacer" />
          <button className="btn btn-ghost" onClick={() => setView({ name: 'settings' })}>
            <Icon name="settings" size={17} /> Settings
          </button>
        </div>
      </header>

      <main className="container">
        {view.name === 'list' && (
          <BatchList onOpen={(id) => setView({ name: 'batch', id })} />
        )}
        {view.name === 'batch' && (
          <BatchDetail
            batchId={view.id}
            settings={settings}
            onBack={() => setView({ name: 'list' })}
            onOpenSettings={() => setView({ name: 'settings' })}
          />
        )}
        {view.name === 'settings' && (
          <Settings
            settings={settings}
            onSaved={refreshSettings}
            onBack={() => setView({ name: 'list' })}
          />
        )}
      </main>
    </>
  )
}
