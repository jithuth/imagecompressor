'use client'

type Tone = 'professional' | 'casual' | 'luxury' | 'playful';

const tones: { value: Tone; label: string; emoji: string; color: string; active: string }[] = [
  { value: 'professional', label: 'Professional', emoji: '🎯', color: 'border-zinc-700 text-zinc-300 hover:border-blue-500 hover:text-blue-300', active: 'border-blue-500 bg-blue-500/10 text-blue-300' },
  { value: 'casual',       label: 'Casual',       emoji: '💬', color: 'border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300', active: 'border-emerald-500 bg-emerald-500/10 text-emerald-300' },
  { value: 'luxury',       label: 'Luxury',       emoji: '💎', color: 'border-zinc-700 text-zinc-300 hover:border-yellow-500 hover:text-yellow-300', active: 'border-yellow-500 bg-yellow-500/10 text-yellow-300' },
  { value: 'playful',      label: 'Playful',      emoji: '🎉', color: 'border-zinc-700 text-zinc-300 hover:border-pink-500 hover:text-pink-300', active: 'border-pink-500 bg-pink-500/10 text-pink-300' },
];

interface ToneSelectorProps {
  value: Tone;
  onChange: (tone: Tone) => void;
}

export type { Tone };

export default function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tones.map(tone => (
        <button
          key={tone.value}
          onClick={() => onChange(tone.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-200 ${value === tone.value ? tone.active : tone.color}`}
        >
          <span>{tone.emoji}</span>
          {tone.label}
        </button>
      ))}
    </div>
  );
}
