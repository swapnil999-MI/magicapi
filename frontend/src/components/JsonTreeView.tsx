import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

interface JsonTreeViewProps {
  data: any;
  searchFilter?: string;
}

export const JsonTreeView: React.FC<JsonTreeViewProps> = ({ data, searchFilter = '' }) => {
  return (
    <div className="font-mono text-xs p-3 space-y-0.5 overflow-auto h-full select-text">
      <TreeNode name="root" value={data} isRoot searchFilter={searchFilter.toLowerCase()} />
    </div>
  );
};

interface TreeNodeProps {
  name: string;
  value: any;
  isRoot?: boolean;
  searchFilter: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({ name, value, isRoot = false, searchFilter }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const copyVal = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isMatch = searchFilter && name.toLowerCase().includes(searchFilter);

  const renderValue = () => {
    if (value === null) return <span className="text-slate-400 font-semibold">null</span>;
    if (typeof value === 'boolean') return <span className="text-amber-400 font-semibold">{String(value)}</span>;
    if (typeof value === 'number') return <span className="text-rose-400 font-semibold">{value}</span>;
    if (typeof value === 'string') return <span className="text-emerald-400">"{value}"</span>;
    return null;
  };

  if (!isExpandable) {
    return (
      <div className={`flex items-center gap-2 py-0.5 px-1.5 rounded hover:bg-white/5 group ${isMatch ? 'bg-blue-500/20' : ''}`}>
        {!isRoot && <span className="text-blue-400 font-semibold">{name}:</span>}
        {renderValue()}
        <button
          onClick={copyVal}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-dim)] hover:text-white rounded transition-opacity"
          title="Copy value"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  const childCount = isArray ? value.length : Object.keys(value).length;
  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  return (
    <div className="space-y-0.5">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-white/5 cursor-pointer select-none group ${
          isMatch ? 'bg-blue-500/20' : ''
        }`}
      >
        <button className="text-[var(--text-dim)] hover:text-white p-0.5">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {!isRoot && <span className="text-blue-400 font-semibold">{name}:</span>}
        <span className="text-[var(--text-dim)] font-semibold text-[11px]">
          {bracketOpen} {childCount} {isArray ? 'items' : 'keys'} {bracketClose}
        </span>

        <button
          onClick={copyVal}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-dim)] hover:text-white rounded transition-opacity ml-auto"
          title="Copy JSON block"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pl-4 border-l border-[var(--border-color)]/60 ml-2 space-y-0.5">
          {isArray
            ? value.map((item: any, idx: number) => (
                <TreeNode key={idx} name={String(idx)} value={item} searchFilter={searchFilter} />
              ))
            : Object.entries(value).map(([k, v]) => (
                <TreeNode key={k} name={k} value={v} searchFilter={searchFilter} />
              ))}
        </div>
      )}
    </div>
  );
};
