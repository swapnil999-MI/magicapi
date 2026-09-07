import React from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { Rocket, BookOpen, Zap, Target, Layers, Search, Globe, Moon, Sun, Monitor, Sparkles, Workflow } from 'lucide-react';

export const TopNavbar: React.FC = () => {
  const {
    spec,
    viewMode,
    setViewMode,
    tabModeEnabled,
    setTabModeEnabled,
    theme,
    setTheme,
    environment,
    environments,
    setEnvironment,
    setVariablesModalOpen,
    setCmdPaletteOpen,
  } = useStudioStore();

  const logoSrc = theme === 'light' ? '/magicapi-logo-light.png' : '/magicapi-logo.png';

  return (
    <header className="h-14 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] flex items-center justify-between px-4 select-none shrink-0 z-50 gap-4">
      {/* ZONE 1: Left Brand & Navigation */}
      <div className="flex items-center gap-3.5 shrink-0">
        <div className="flex items-center gap-2.5 group cursor-pointer">
          <div className="relative flex items-center justify-center h-9 w-9 bg-transparent transition-transform duration-200 group-hover:scale-110 shrink-0">
            <img 
              src={logoSrc} 
              alt="MagicAPI Logo" 
              className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(168,85,247,0.4)] group-hover:drop-shadow-[0_4px_14px_rgba(168,85,247,0.65)] transition-all" 
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight text-[var(--text-main)] leading-none">
              MagicAPI
            </span>
            <span className="font-semibold text-[10px] text-[var(--text-muted)] tracking-wider uppercase bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] leading-none hidden sm:inline-block">
              Studio
            </span>
          </div>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-glow)] text-[var(--border-focus)] border border-[var(--border-focus)]/30 font-bold leading-none">
            {spec?.info?.version || 'v2.1'}
          </span>
        </div>

        {/* View Switcher: Docs vs Studio vs Workflow */}
        <div className="flex bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg p-0.5 gap-0.5 select-none">
          <button
            onClick={() => setViewMode('docs')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all outline-none cursor-pointer ${
              viewMode === 'docs'
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Docs</span>
          </button>
          <button
            onClick={() => setViewMode('studio')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all outline-none cursor-pointer ${
              viewMode === 'studio'
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Studio</span>
          </button>
          <button
            onClick={() => setViewMode('workflow')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all outline-none cursor-pointer ${
              viewMode === 'workflow'
                ? 'bg-[var(--bg-card)] text-purple-400 shadow-xs font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
            }`}
          >
            <Workflow className="w-3.5 h-3.5 text-purple-400" />
            <span>Workflow</span>
          </button>
        </div>

        {/* Focus vs Multi-Tab Mode Switcher (Visible in Studio) */}
        {viewMode === 'studio' && (
          <div className="flex bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg p-0.5 gap-0.5 select-none">
            <button
              onClick={() => setTabModeEnabled(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all outline-none cursor-pointer ${
                !tabModeEnabled
                  ? 'bg-[var(--bg-card)] text-[var(--border-focus)] shadow-xs font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
              }`}
              title="Focused Single API View"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Focus</span>
            </button>
            <button
              onClick={() => setTabModeEnabled(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all outline-none cursor-pointer ${
                tabModeEnabled
                  ? 'bg-[var(--bg-card)] text-[var(--border-focus)] shadow-xs font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
              }`}
              title="Postman-style Multi-Tab Workspace"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tabs</span>
            </button>
          </div>
        )}
      </div>

      {/* ZONE 2: Center Universal Command Palette Capsule */}
      <div className="flex-1 max-w-md flex justify-center">
        <button
          onClick={() => setCmdPaletteOpen(true)}
          className="w-full h-8 bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--border-focus)] rounded-lg flex items-center px-3 gap-2.5 transition-all text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)]"
        >
          <Search className="w-3.5 h-3.5 opacity-60" />
          <span className="flex-1 text-left text-xs font-normal truncate">
            Search endpoints, models, parameters...
          </span>
          <kbd className="font-mono text-[10px] bg-[var(--bg-card)] border border-[var(--border-color)] px-1.5 py-0.5 rounded text-[var(--text-muted)] font-semibold shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ZONE 3: Right Environment, Variables & Theme */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Environment Picker */}
        <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 h-8 gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="bg-transparent text-xs font-mono font-medium text-[var(--text-main)] outline-none cursor-pointer max-w-[160px] truncate"
          >
            {environments.map((env) => (
              <option key={env.url} value={env.url} className="bg-[var(--bg-card)] text-[var(--text-main)]">
                {env.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Variables Modal Trigger */}
        <button
          onClick={() => setVariablesModalOpen(true)}
          className="h-8 px-2.5 bg-[var(--bg-card)] hover:border-[var(--border-focus)] border border-[var(--border-color)] rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 transition-all"
          title="Manage Dynamic Environment Variables ({{var}})"
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>Vars</span>
        </button>

        {/* Theme Picker */}
        <div className="relative">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="h-8 px-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs font-medium text-[var(--text-main)] outline-none cursor-pointer"
            title="Theme Palette"
          >
            <option value="dark">🌙 Dark</option>
            <option value="midnight">🌌 Midnight</option>
            <option value="cyberpunk">👾 Neon</option>
            <option value="light">☀️ Light</option>
          </select>
        </div>
      </div>
    </header>
  );
};
