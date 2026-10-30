import React, { useState } from 'react';
import {
  FolderArchive,
  Search,
  Smartphone,
  Download,
  Trash2,
  Edit2,
  Archive,
  ShieldCheck,
  Check,
  Copy
} from 'lucide-react';
import { StorageFile } from '../lib/types';
import { formatBytes, formatDate } from '../lib/formatters';

interface FileManagerViewProps {
  files: StorageFile[];
  onDownloadToPhone: (file: StorageFile) => void;
  onDirectDownload: (file: StorageFile) => void;
  onDeleteFile: (file: StorageFile) => void;
  onRenameFile: (file: StorageFile, newName: string) => Promise<void>;
  onCreateZip: (file: StorageFile) => Promise<void>;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  files,
  onDownloadToPhone,
  onDirectDownload,
  onDeleteFile,
  onRenameFile,
  onCreateZip,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [renameTarget, setRenameTarget] = useState<StorageFile | null>(null);
  const [newNameInput, setNewNameInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.torrentName && f.torrentName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  const handleStartRename = (file: StorageFile) => {
    setRenameTarget(file);
    setNewNameInput(file.name);
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !newNameInput) return;
    setIsProcessing(true);
    try {
      await onRenameFile(renameTarget, newNameInput);
      setRenameTarget(null);
      setStatusMsg('File renamed successfully');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleZip = async (file: StorageFile) => {
    setIsProcessing(true);
    try {
      await onCreateZip(file);
      setStatusMsg('Created compressed archive in cloud storage');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Cloud Storage File Manager</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage completed torrent payloads on server NVMe storage
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search stored files..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Storage Summary */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono">
        <div className="text-slate-400">
          Showing <strong className="text-slate-200">{filteredFiles.length}</strong> of {files.length} items
        </div>
        <div className="text-slate-400">
          Total Storage Consumed: <strong className="text-emerald-400">{formatBytes(totalBytes)}</strong>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          {statusMsg}
        </div>
      )}

      {/* Table view */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
              <tr>
                <th className="py-3 px-4">Filename</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Last Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No files found matching your search.
                  </td>
                </tr>
              ) : (
                filteredFiles.map(file => (
                  <tr key={file.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white max-w-xs sm:max-w-md truncate" title={file.name}>
                        {file.name}
                      </div>
                      {file.torrentName && (
                        <div className="text-[10px] text-indigo-400 font-medium">
                          {file.torrentName}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400 whitespace-nowrap">
                      {formatBytes(file.size)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 uppercase text-[11px] whitespace-nowrap">
                      {file.extension || 'BIN'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {formatDate(file.modifiedAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onDownloadToPhone(file)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                          title="Generate Android Chrome Link & QR"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Phone</span>
                        </button>

                        <button
                          onClick={() => onDirectDownload(file)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Direct Browser Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleZip(file)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Create Compressed ZIP Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleStartRename(file)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Rename File"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onDeleteFile(file)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400"
                          title="Delete File Permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rename Dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Rename File</h3>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">New Filename</label>
              <input
                type="text"
                value={newNameInput}
                onChange={e => setNewNameInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRename}
                disabled={isProcessing || !newNameInput}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {isProcessing ? 'Renaming...' : 'Save Rename'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
