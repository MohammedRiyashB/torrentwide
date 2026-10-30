import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  X,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Download,
  Clock,
  Sparkles,
  ExternalLink,
  Info
} from 'lucide-react';
import { StorageFile, DownloadToken } from '../lib/types';
import { formatBytes } from '../lib/formatters';
import { generateQrSvg } from '../lib/qrCode';

interface DownloadToPhoneModalProps {
  file: StorageFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadToPhoneModal: React.FC<DownloadToPhoneModalProps> = ({
  file,
  isOpen,
  onClose,
}) => {
  const [tokenData, setTokenData] = useState<DownloadToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [singleUse, setSingleUse] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && file) {
      issueToken();
    } else {
      setTokenData(null);
      setError(null);
    }
  }, [isOpen, file, durationMinutes, singleUse]);

  const issueToken = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(file.id)}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes, singleUse }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to issue download token');
      }
      const token = await res.json();
      setTokenData(token);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const downloadUrl = tokenData
    ? `${window.location.origin}/api/download/${tokenData.token}`
    : '';

  const handleCopy = () => {
    if (!downloadUrl) return;
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartDownload = () => {
    if (downloadUrl) {
      window.location.href = downloadUrl;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Download to Phone
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                ANDROID CHROME READY
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Authenticated HTTP 206 Range stream with background resume support
            </p>
          </div>
        </div>

        {/* File Summary Card */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 mb-5">
          <div className="text-xs font-semibold text-slate-400 mb-1">SELECTED FILE</div>
          <div className="text-sm font-bold text-white truncate">{file.name}</div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-1">
            <span>Size: <strong className="text-emerald-400">{formatBytes(file.size)}</strong></span>
            <span>MIME: <strong className="text-cyan-400">{file.mimeType}</strong></span>
          </div>
        </div>

        {/* Token Configuration */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
          <div>
            <label className="block font-medium text-slate-400 mb-1">Link Expiration</label>
            <select
              value={durationMinutes}
              onChange={e => setDurationMinutes(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value={15}>15 Minutes</option>
              <option value={60}>1 Hour (Recommended)</option>
              <option value={1440}>24 Hours</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-400 mb-1">Access Mode</label>
            <select
              value={singleUse ? 'single' : 'multi'}
              onChange={e => setSingleUse(e.target.value === 'single')}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="multi">Multi-Use (Phone + Tablets)</option>
              <option value="single">Single Use (Revoke after 1 download)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* QR Code & Direct Link Section */}
        {tokenData && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-5">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* SVG QR Code */}
              <div className="flex flex-col items-center">
                <div
                  className="w-36 h-36 flex items-center justify-center p-1 bg-white rounded-xl shadow-md"
                  dangerouslySetInnerHTML={{ __html: generateQrSvg(downloadUrl, 136) }}
                />
                <span className="text-[11px] text-slate-400 mt-2 font-medium flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                  Scan with Phone Camera
                </span>
              </div>

              {/* Action Buttons & Details */}
              <div className="flex-1 w-full space-y-3">
                <button
                  onClick={handleStartDownload}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Start Download in Android Chrome</span>
                </button>

                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Authenticated Link</span>
                    <button
                      onClick={handleCopy}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-300 truncate select-all w-full">
                    {downloadUrl}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Expires at {new Date(tokenData.expiresAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Android Chrome Technical Benefits */}
        <div className="border-t border-slate-800/80 pt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>Why Ultra Download Hub Mobile Delivery is Superior:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div className="flex items-start gap-1.5 bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>HTTP 206 Partial Content:</strong> Android Chrome can pause and resume even if network switches from Wi-Fi to 5G.</span>
            </div>
            <div className="flex items-start gap-1.5 bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span><strong>Zero-RAM Streaming:</strong> Files stream directly from VPS NVMe storage into the mobile browser without server memory bottlenecks.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
