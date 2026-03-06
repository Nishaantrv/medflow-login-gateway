import { analyzeReadability } from '@/services/readabilityScorer';

interface ReadabilityBadgeProps {
    text: string;
    className?: string;
}

const ReadabilityBadge = ({ text, className = "" }: ReadabilityBadgeProps) => {
    const result = analyzeReadability(text);

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm border border-white/10 ${className}`}
            style={{ backgroundColor: result.color }}
        >
            <span>Grade {result.grade}</span>
            <span className="opacity-40">·</span>
            <span>{result.emoji} {result.label}</span>
        </div>
    );
};

export default ReadabilityBadge;
