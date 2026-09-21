import React from 'react';
import { Folder, FolderCheck, FolderPlus, HelpCircle, HardDrive, Sparkles, Tag, Check } from 'lucide-react';
import { FolderConfig, NamingStyle, OutputAudioFormat } from '../types';
import { generateOutputName } from '../utils/audioEngine';

interface FolderAndNamingSettingsProps {
  folderConfig: FolderConfig;
  onChangeFolderConfig: (newConfig: FolderConfig) => void;
  outputFormat: OutputAudioFormat;
  selectedDirectoryHandle: any | null;
  onSelectDirectory: () => Promise<void>;
  onClearDirectory: () => void;
  selectedDirectoryName: string | null;
}

export const FolderAndNamingSettings: React.FC<FolderAndNamingSettingsProps> = ({
  folderConfig,
  onChangeFolderConfig,
  outputFormat,
  selectedDirectoryHandle,
  onSelectDirectory,
  onClearDirectory,
  selectedDirectoryName,
}) => {
  const isFileSystemSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Sample file settings for live preview
  const sampleSettings = {
    speedUp: 2.326,
    robloxPlaybackSpeed: 0.43,
    outputFormat,
    pitchMode: 'resample' as const,
    amplifyDb: 3,
    preserveQuality: true,
    reverbType: 'room' as const,
    reverbMix: 0.3,
    reverbDecay: 1.8,
    fadeInEnabled: true,
    fadeInDuration: 2.0,
    fadeOutEnabled: true,
    fadeOutDuration: 3.0,
  };

  const samplePreviewName = generateOutputName(
    'Alan_Walker_Faded',
    sampleSettings,
    outputFormat,
    folderConfig
  );

  const namingStyles: { id: NamingStyle; label: string; desc: string; example: string }[] = [
    {
      id: 'clean',
      label: 'Rapi & Ringkas (Rekomendasi)',
      desc: 'Hanya nama audio + angka Roblox PlaybackSpeed. Sangat rapi & tidak panjang.',
      example: `Alan_Walker_Faded_0.43.${outputFormat}`,
    },
    {
      id: 'roblox',
      label: 'Label Roblox',
      desc: 'Nama audio + tag Roblox untuk kemudahan identifikasi di Asset Manager.',
      example: `Alan_Walker_Faded_Roblox0.43.${outputFormat}`,
    },
    {
      id: 'original',
      label: 'Nama Asli (Minimalis)',
      desc: 'Hanya nama lagu tanpa tambahan tag kecepatan.',
      example: `Alan_Walker_Faded.${outputFormat}`,
    },
    {
      id: 'detailed',
      label: 'Detail Lengkap',
      desc: 'Format komprehensif berisi speed, roblox speed, amp, reverb & fade.',
      example: `Alan_Walker_Faded_[speed2.33x_roblox0.43...].${outputFormat}`,
    },
  ];

  return (
    <div
      id="folder-naming-settings-card"
      className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Folder Output & Format Nama File Rapi</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                Rapi & Terstruktur
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Tentukan folder tujuan penyimpanan dan gaya penamaan agar file tidak terlalu panjang
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Folder Selection & Custom Folder Name */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label htmlFor="custom-folder-name" className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-amber-400" />
                <span>Nama Folder Khusus</span>
              </label>
              <span className="text-[10px] text-slate-500">Folder target di ZIP & Komputer</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono text-xs">📁 /</span>
              <input
                id="custom-folder-name"
                type="text"
                value={folderConfig.folderName}
                onChange={(e) =>
                  onChangeFolderConfig({
                    ...folderConfig,
                    folderName: e.target.value.replace(/[<>:"/\\|?*]/g, '_') || 'Roblox_Audio_Output',
                  })
                }
                placeholder="Roblox_Audio_Output"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5">
              Semua file unduhan batch (ZIP) akan otomatis dimasukkan rapi ke dalam folder ini.
            </div>
          </div>

          {/* Direct Computer Folder Picker */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Simpan Langsung ke Folder Komputer</span>
              </span>
              {isFileSystemSupported ? (
                <span className="text-[10px] text-emerald-400 font-medium">Didukung Browser</span>
              ) : (
                <span className="text-[10px] text-slate-500">Gunakan Unduh Normal</span>
              )}
            </div>

            {selectedDirectoryName ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-xs">
                <div className="flex items-center gap-2 text-emerald-300 min-w-0">
                  <FolderCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="truncate font-mono font-medium">{selectedDirectoryName}</span>
                </div>
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={onSelectDirectory}
                    className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    Ganti Folder
                  </button>
                  <button
                    type="button"
                    onClick={onClearDirectory}
                    className="px-2 py-1 text-[11px] rounded bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 transition"
                  >
                    Lepas
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onSelectDirectory}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition flex items-center justify-center gap-2"
                >
                  <Folder className="w-4 h-4 text-amber-400" />
                  <span>Pilih Folder di Komputer Anda</span>
                </button>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pilih folder di PC/laptop Anda (misalnya di Desktop atau folder Roblox Anda). File hasil unduhan dapat langsung ditulis ke sana.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Clean File Naming Styles */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-cyan-400" />
                <span>Gaya Penamaan File (Naming Style)</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Bebas Kepanjangan</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {namingStyles.map((style) => {
                const isSelected = folderConfig.namingStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => onChangeFolderConfig({ ...folderConfig, namingStyle: style.id })}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/70 ring-1 ring-cyan-500/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {style.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-2 leading-tight mb-2">
                      {style.desc}
                    </div>
                    <div className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 truncate">
                      {style.example}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional Prefix & Effect Tag Checkbox */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Prefix Tambahan (Opsional):</label>
                <input
                  type="text"
                  value={folderConfig.customPrefix}
                  onChange={(e) =>
                    onChangeFolderConfig({
                      ...folderConfig,
                      customPrefix: e.target.value.replace(/[<>:"/\\|?*]/g, '_'),
                    })
                  }
                  placeholder="Misal: Roblox_"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center pt-2 sm:pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={folderConfig.includeEffectsInName}
                    onChange={(e) =>
                      onChangeFolderConfig({
                        ...folderConfig,
                        includeEffectsInName: e.target.checked,
                      })
                    }
                    className="rounded accent-cyan-500 cursor-pointer w-4 h-4"
                  />
                  <span>Sertakan info efek jika aktif (misal: +3dB)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 block">Preview Nama File Hasil:</span>
                <span className="text-xs font-mono font-bold text-cyan-300 truncate block">
                  {folderConfig.folderName}/<span className="text-white">{samplePreviewName}</span>
                </span>
              </div>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-2 py-0.5 rounded font-mono shrink-0">
              {samplePreviewName.length} karakter
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
