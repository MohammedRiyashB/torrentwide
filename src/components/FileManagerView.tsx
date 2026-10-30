import React, { useMemo, useState } from 'react';
import { Search, Download, FolderArchive } from 'lucide-react';
import { StorageFile } from '../lib/types';
import { formatBytes } from '../lib/formatters';

interface FileManagerViewProps {
  files: StorageFile[];
  onDownloadToPhone: (file: StorageFile) => void;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({ files, onDownloadToPhone }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredFiles = useMemo(() => files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.torrentName || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [files, searchTerm]);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">Torrent File Manager</h2>
          <p className="text-xs text-slate-400 mt-1">Browse completed files from your owned torrents</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search files or torrents..." className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200" />
        </div>
      </div>
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-400">
        <span>Showing <strong className="text-slate-200">{filteredFiles.length}</strong> of {files.length} files</span>
        <span>Total: <strong className="text-emerald-400">{formatBytes(totalBytes)}</strong></span>
      </div>
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
        {filteredFiles.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs"><FolderArchive className="w-8 h-8 mx-auto mb-2" />No completed files found.</div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredFiles.map(file => (
              <div key={file.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white break-all">{file.name}</div>
                  <div className="text-[10px] text-indigo-400">{file.torrentName}</div>
                  <div className="text-xs font-mono text-slate-400 mt-1">{formatBytes(file.size)} · {file.extension}</div>
                </div>
                <button onClick={() => onDownloadToPhone(file)} className="shrink-0 p-2 rounded-lg bg-slate-800 hover:bg-emerald-700 text-slate-200" title="Download file">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
