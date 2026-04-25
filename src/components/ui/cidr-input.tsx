'use client';

import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function CidrInput({
  value,
  onChange,
  placeholder = '10.0.0.0/8',
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      remove(value.length - 1);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 border rounded-md px-2 py-1.5 min-h-9 focus-within:ring-1 focus-within:ring-ring">
      {value.map((cidr, i) => (
        <Badge key={i} variant="secondary" className="gap-1 font-mono text-xs">
          {cidr}
          <button type="button" onClick={() => remove(i)} className="hover:text-destructive">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : ''}
        className="border-0 p-0 h-6 min-w-24 flex-1 shadow-none focus-visible:ring-0 text-xs font-mono"
      />
    </div>
  );
}
