import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  DownloadCloud,
  Smartphone,
  FolderArchive,
  History,
  Sliders,
  HardDrive,
  ShieldAlert,
  Server
} from 'lucide-react';

export type TabKey =
  | 'dashboard'
  | 'add'
  | 'active'
  | 'completed'
  | 'files'
  | 'history'
  | 'performance'
  | 'storage'
  | 'security'
  | 'system';

interface NavigationProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  activeCount: number;
  completedCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  activeCount,
  completedCount,
  isMobileOpen,
  onCloseMobile,
}) => {
  const tabs = [
    { key: 'dashboard' as TabKey, label: 'Dashboard', icon: LayoutDashboard },
    { key: 'add' as TabKey, label: 'Add Torrent', icon: PlusCircle, highlight: true },
    { key: 'active' as TabKey, label: 'Active', icon: DownloadCloud, count: activeCount },
    { key: 'completed' as TabKey, label: 'Completed & Phone', icon: Smartphone, count: completedCount, special: true },
    { key: 'files' as TabKey, label: 'File Manager', icon: FolderArchive },
    { key: 'history' as TabKey, label: 'History', icon: History },
    { key: 'performance' as TabKey, label: 'Performance', icon: Sliders },
    { key: 'storage' as TabKey, label: 'Storage', icon: HardDrive },
    { key: 'security' as TabKey, label: 'Security & Audit', icon: ShieldAlert },
    { key: 'system' as TabKey, label: 'System & VPS', icon: Server },
  ];

  const handleSelect = (key: TabKey) => {
    onTabChange(key);
    onCloseMobile();
  };

  return (
    <>
      {/* Desktop Horizontal Navigation Bar */}
      <nav className="bg-slate-900/70 border-b border-slate-800/80 px-4 lg:px-8 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-2 scrollbar-thin">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleSelect(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? tab.special
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.highlight ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-xl flex flex-col pt-16 px-4 pb-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation Menu</span>
            <button
              onClick={onCloseMobile}
              className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleSelect(tab.key)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? tab.special
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 text-white'
                      : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
