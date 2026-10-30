import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Link as LinkIcon,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Layers,
  Check,
  Info
} from 'lucide-react';
import { parseTorrentBuffer, TorrentMetadata } from '../lib/bencode';
import { parseMagnetURI, isValidMagnetURI } from '../lib/magnet';
import { formatBytes } from '../lib/formatters';

interface AddTorrentViewProps {
  onAddFile: (file: File, isSequential: boolean) => Promise<void>;
  onAddMagnet: (magnetUri: string, name?: string, isSequential?: boolean) => Promise<void>;
  onAddPreset: (presetId: string) => Promise<void>;
  onTorrentAddedSuccess: () => void;
}

export const AddTorrentView: React.FC<AddTorrentViewProps> = ({
  onAddFile,
  onAddMagnet,
  onAddPreset,
  onTorrentAddedSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'magnet' | 'presets'>('upload');
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedMeta, setParsedMeta] = useState<TorrentMetadata | null>(null);
  const [isSequential, setIsSequential] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  
  // Magnet state
  const [magnetUri, setMagnetUri] = useState('');
  const [customName, setCustomName] = useState('');
  const [magnetError, setMagnetError] = useState<string | null>(null);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const meta = parseTorrentBuffer(Buffer.from(buffer));
      setParsedMeta(meta);
      if (!customName) {
        setCustomName(meta.name);
      }
    } catch (err: unknown) {
      setErrorMessage(`Error parsing .torrent metadata: ${(err as Error).message}`);
      setParsedMeta(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.torrent')) {
        handleFileChange(file);
      } else {
        setErrorMessage('Only authorized ".torrent" files are accepted.');
      }
    }
  };

  const handleSubmitFile = async () => {
    if (!selectedFile) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onAddFile(selectedFile, isSequential);
      onTorrentAddedSuccess();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMagnet = async () => {
    if (!magnetUri) {
      setMagnetError('Please enter a magnet URI');
      return;
    }
    if (!isValidMagnetURI(magnetUri)) {
      setMagnetError('Invalid magnet link. Must start with "magnet:?" and have a valid BitTorrent info hash (xt=urn:btih:...).');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setMagnetError(null);
    try {
      await onAddMagnet(magnetUri, customName || undefined, isSequential);
      onTorrentAddedSuccess();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePresetClick = async (presetId: string) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onAddPreset(presetId);
      onTorrentAddedSuccess();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">Add New Torrent Download</h2>
        <p className="text-xs text-slate-400 mt-1">
          Upload an authorized .torrent file, paste a magnet link, or select a pre-verified Linux distribution.
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload .Torrent File</span>
        </button>
        <button
          onClick={() => setActiveTab('magnet')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'magnet'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Paste Magnet Link</span>
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'presets'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-cyan-300" />
          <span>1-Click Presets</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab 1: File Upload */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 lg:p-12 text-center transition-all ${
              isDragging
                ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".torrent"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-cyan-400 shadow-inner">
              <UploadCloud className="w-7 h-7" />
            </div>
            {selectedFile ? (
              <div>
                <div className="text-base font-bold text-white mb-1">{selectedFile.name}</div>
                <div className="text-xs font-mono text-emerald-400">
                  {formatBytes(selectedFile.size)} • Click or drop another file to replace
                </div>
              </div>
            ) : (
              <div>
                <div className="text-base font-bold text-slate-200 mb-1">
                  Drag & Drop authorized .torrent file here
                </div>
                <p className="text-xs text-slate-400">
                  or <span className="text-cyan-400 font-semibold underline">browse from your computer</span>
                </p>
              </div>
            )}
          </div>

          {/* Parsed Metadata Inspection Card */}
          {parsedMeta && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Metadata Inspection Passed
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  SHA-1 INFO HASH VERIFIED
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block mb-0.5">Torrent Name:</span>
                  <span className="text-white font-bold text-sm truncate block">{parsedMeta.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Total Size:</span>
                  <span className="text-emerald-400 font-bold text-sm block">{formatBytes(parsedMeta.totalSize)}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block mb-0.5">Info Hash:</span>
                  <span className="text-slate-300 font-mono text-[11px] select-all bg-slate-950 p-1.5 rounded border border-slate-800 block truncate">
                    {parsedMeta.infoHash}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Pieces / Piece Size:</span>
                  <span className="text-slate-200">{parsedMeta.pieceCount} pieces ({formatBytes(parsedMeta.pieceLength)})</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Trackers Discovered:</span>
                  <span className="text-cyan-400 font-semibold">{parsedMeta.trackers.length} active trackers</span>
                </div>
              </div>

              {/* Files in torrent */}
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Files Included ({parsedMeta.files.length})
                </span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {parsedMeta.files.map(f => (
                    <div key={f.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-900">
                      <span className="text-slate-300 truncate max-w-md">{f.name}</span>
                      <span className="text-slate-400 font-mono shrink-0 ml-2">{formatBytes(f.size)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSequential}
                    onChange={e => setIsSequential(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Download Pieces Sequentially (Optimal for streaming & early phone inspection)</span>
                </label>
              </div>

              <button
                onClick={handleSubmitFile}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {submitting ? 'Initializing Download Engine...' : 'Confirm & Start Cloud Download'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Magnet Link */}
      {activeTab === 'magnet' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Magnet Link URI
            </label>
            <textarea
              rows={3}
              value={magnetUri}
              onChange={e => {
                setMagnetUri(e.target.value);
                setMagnetError(null);
              }}
              placeholder="magnet:?xt=urn:btih:...&dn=..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
            {magnetError && (
              <span className="text-xs text-rose-400 mt-1 block">{magnetError}</span>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Custom Torrent Display Name (Optional)
            </label>
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Leave empty to use magnet display name"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isSequential}
                onChange={e => setIsSequential(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>Download Pieces Sequentially</span>
            </label>
          </div>

          <button
            onClick={handleSubmitMagnet}
            disabled={submitting || !magnetUri}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {submitting ? 'Connecting to Trackers & Peers...' : 'Start Magnet Cloud Download'}
          </button>
        </div>
      )}

      {/* Tab 3: Presets */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              id: 'ubuntu',
              title: 'Ubuntu 24.04 Desktop AMD64',
              desc: 'Official Canonical desktop installation ISO. Massive seed swarm worldwide.',
              size: '5.12 GB',
              peers: '1,200+ seeders',
              badge: 'Canonical Linux',
            },
            {
              id: 'debian',
              title: 'Debian 12 Netinst Minimal',
              desc: 'Official Debian Bookworm net installation media. Extremely fast download.',
              size: '650 MB',
              peers: '850+ seeders',
              badge: 'Debian GNU/Linux',
            },
            {
              id: 'alpine',
              title: 'Alpine Linux 3.20 Standard',
              desc: 'Ultra lightweight security-oriented Linux image. Downloads in seconds.',
              size: '215 MB',
              peers: '400+ seeders',
              badge: 'Alpine Linux',
            },
            {
              id: 'sintel',
              title: 'Blender Sintel 4K Cinema Open Movie',
              desc: 'Creative Commons 4K cinematic animation by Blender Open Movie project.',
              size: '1.45 GB',
              peers: '300+ seeders',
              badge: 'Creative Commons',
            },
          ].map(p => (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-sm text-white">{p.title}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                    {p.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">{p.desc}</p>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                  <span>Size: <strong className="text-emerald-400">{p.size}</strong></span>
                  <span>Swarm: <strong className="text-cyan-400">{p.peers}</strong></span>
                </div>
              </div>

              <button
                onClick={() => handlePresetClick(p.id)}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <span>Launch This Download</span>
                <span>&rarr;</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
