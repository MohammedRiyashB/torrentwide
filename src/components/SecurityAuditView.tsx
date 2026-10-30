import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, Lock, AlertTriangle, CheckCircle2, Clock, Ban } from 'lucide-react';
import { DownloadToken, AuditLogItem } from '../lib/types';
import { formatDate, formatBytes } from '../lib/formatters';

interface SecurityAuditViewProps {
  tokens: DownloadToken[];
  auditLogs: AuditLogItem[];
  onRevokeToken: (token: string) => Promise<void>;
}

export const SecurityAuditView: React.FC<SecurityAuditViewProps> = ({
  tokens,
  auditLogs,
  onRevokeToken,
}) => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'logs'>('tokens');
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const handleRevoke = async (tokenStr: string) => {
    setRevokingToken(tokenStr);
    try {
      await onRevokeToken(tokenStr);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRevokingToken(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Security Controls & Audit Logs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage temporary mobile download tokens, access revocation, and security audit events
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'tokens' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Tokens ({tokens.filter(t => !t.revoked).length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Log ({auditLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'tokens' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">
            <strong>Download Token Security Policy:</strong> Every "DOWNLOAD TO PHONE" link is signed with an HMAC-SHA256 signature, expires after a maximum defined duration, and can be immediately revoked below without deleting the underlying file.
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">Token Preview</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4">Uses</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No download tokens have been generated yet.
                      </td>
                    </tr>
                  ) : (
                    tokens.map(t => {
                      const isExpired = Date.now() > t.expiresAt;
                      return (
                        <tr key={t.token} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white max-w-xs truncate">
                            {t.fileName}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                            {t.token.slice(0, 16)}...
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                            {formatDate(t.createdAt)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-amber-400 whitespace-nowrap">
                            {formatDate(t.expiresAt)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {t.usedCount} / {t.maxUses}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {t.revoked ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                                REVOKED
                              </span>
                            ) : isExpired ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold">
                                EXPIRED
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                ACTIVE
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {!t.revoked && !isExpired && (
                              <button
                                onClick={() => handleRevoke(t.token)}
                                disabled={revokingToken === t.token}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Revoke</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Source IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                      No security audit events recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${
                            log.severity === 'security'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : log.severity === 'warning'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        {log.details}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 text-[11px] whitespace-nowrap">
                        {log.ip}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
