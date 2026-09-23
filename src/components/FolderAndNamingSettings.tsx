import React from 'react';
import { FolderConfig, NamingStyle } from '../types';
import {
  Folder,
  Tag,
  HardDrive,
  Settings2,
} from 'lucide-react';

interface FolderAndNamingSettingsProps {
  config: FolderConfig;
  onChangeConfig: (newConfig: FolderConfig) => void;
  directFolderHandle: FileSystemDirectoryHandle | null;
  onRequestSelectFolder: () => void;
}

export const FolderAndNamingSettings: React.FC<FolderAndNamingSettingsProps> = ({
  config,
  onChangeConfig,
  directFolderHandle,
  onRequestSelectFolder,
}) => {
  const namingStyles: { id: NamingStyle; label: string; example: string }[] = [
    { id: 'clean', label: 'Artis & Lagu (Standar Roblox)', example: 'Alan Walker - Faded.ogg' },
    { id: 'roblox', label: 'Dengan Info PlaybackSpeed', example: 'Alan Walker - Faded (PBS 0.43).ogg' },
    { id: 'detailed', label: 'Detail Kecepatan & PBS', example: 'Alan Walker - Faded (2.33x PBS 0.43).ogg' },
    { id: 'original', label: 'Judul Asli Bersih', example: 'Alan Walker - Faded.ogg' },
  ];

  const handleFolderNameChange = (folderName: string) => {
    onChangeConfig({
      ...config,
      folderName: folderName.replace(/[/\\?%*:|"<>]/g, ' ') || 'Roblox Audio Output',
    });
  };

  const handleNamingStyleChange = (namingStyle: NamingStyle) => {
    onChangeConfig({
      ...config,
      namingStyle,
    });
  };

  return (
    <div
      id="folder-naming-settings"
      className="relative overflow-hidden rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-6 shadow-xl backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Pengaturan Folder & Format Nama File</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Atur struktur penamaan file output dan direktori tujuan unduhan ZIP
            </p>
          </div>
        </div>

        {/* Direct Computer Folder Selector (Supported in modern Chrome/Edge) */}
        {'showDirectoryPicker' in window && (
          <button
            type="button"
            id="select-computer-folder-btn"
            onClick={onRequestSelectFolder}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 active:scale-95 shadow-sm ${
              directFolderHandle
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>
              {directFolderHandle
                ? `Tersambung: ${directFolderHandle.name}`
                : 'Pilih Folder Komputer Langsung'}
            </span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Folder Name & Custom Prefix */}
        <div className="space-y-3.5">
          <div>
            <label
              htmlFor="folder-name-input"
              className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5"
            >
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>Nama Folder Output (.ZIP / Disk):</span>
            </label>
            <input
              id="folder-name-input"
              type="text"
              value={config.folderName}
              onChange={(e) => handleFolderNameChange(e.target.value)}
              placeholder="Contoh: Roblox Audio Output"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Saat diekspor sebagai ZIP, seluruh file akan tertata rapi di dalam subfolder ini.
            </p>
          </div>

          <div>
            <label
              htmlFor="prefix-input"
              className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5"
            >
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Prefix Kustom (Opsional):</span>
            </label>
            <input
              id="prefix-input"
              type="text"
              value={config.customPrefix}
              onChange={(e) => onChangeConfig({ ...config, customPrefix: e.target.value })}
              placeholder="Contoh: RBX atau Lagu"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 font-mono"
            />
          </div>
        </div>

        {/* Right Column: Naming Style Selection & Preview */}
        <div>
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-2">
            <Tag className="w-3.5 h-3.5 text-purple-400" />
            <span>Gaya Format Nama File:</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {namingStyles.map((style) => (
              <button
                type="button"
                key={style.id}
                onClick={() => handleNamingStyleChange(style.id)}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  config.namingStyle === style.id
                    ? 'bg-purple-500/15 border-purple-500/50 shadow-sm ring-1 ring-purple-500/30'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-xs font-semibold text-white">{style.label}</div>
                <div className="text-[11px] font-mono text-zinc-400 truncate mt-1">
                  {style.example}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
