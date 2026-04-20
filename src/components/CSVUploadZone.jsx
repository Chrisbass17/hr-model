import React, { useRef, useState } from 'react';
import { Upload, FileText, X, CheckCircle2 } from 'lucide-react';
import { parseUploadedCSV } from '../lib/csvUpload';

export function CSVUploadZone({ uploads, onUpload, onRemove }) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFiles(files) {
    setError(null);
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError(`${file.name}: only .csv files are supported`);
        continue;
      }
      try {
        const parsed = await parseUploadedCSV(file);
        onUpload({ fileName: file.name, ...parsed });
      } catch (err) {
        setError(`${file.name}: ${err.message}`);
      }
    }
  }

  return (
    <div className="rounded-lg bg-ink-700 border border-ink-500 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-sm tracking-[0.25em] text-slate-400">
          Recent Form CSVs
        </h2>
        <span className="text-[9px] text-slate-600 font-mono">
          optional · merged into score
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-md border-2 border-dashed p-5 text-center transition-colors ${
          dragOver
            ? 'border-teal-500/50 bg-teal-500/5'
            : 'border-ink-500 hover:border-slate-500 bg-ink-800/50'
        }`}
      >
        <Upload size={18} className="mx-auto text-slate-500 mb-2" />
        <div className="text-xs text-slate-300">
          Drop CSV files here, or <span className="text-teal-400 underline">browse</span>
        </div>
        <div className="text-[10px] text-slate-600 mt-1 font-mono">
          batter form · pitcher vs hand
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="mt-3 text-[11px] text-rose-400 bg-rose-500/10 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {uploads.map((u, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded bg-ink-800 px-2 py-1.5 text-xs"
            >
              <FileText size={12} className="text-slate-500 shrink-0" />
              <span className="text-slate-300 truncate flex-1">{u.fileName}</span>
              <span className="text-[9px] font-mono text-slate-500 uppercase">
                {u.type === 'pitcher_vs_hand' ? 'P vs H' : 'batter'}
              </span>
              <span className="text-[9px] font-mono text-slate-500">
                {u.rows.length}
              </span>
              <CheckCircle2 size={12} className="text-teal-500/70 shrink-0" />
              <button
                onClick={() => onRemove(i)}
                className="text-slate-600 hover:text-rose-400 transition-colors"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
