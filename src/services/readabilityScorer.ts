export function countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, "");
    if (word.length === 0) return 0;

    // Count vowel groups (a, e, i, o, u)
    const vowelGroups = word.match(/[aeiou]+/g);
    let count = vowelGroups ? vowelGroups.length : 0;

    // Subtract 1 for silent 'e' at end of word
    if (word.endsWith("e") && count > 1) {
        count--;
    }

    // Every word has at least 1 syllable
    return Math.max(1, count);
}

export function fleschKincaidGrade(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.match(/\b\w+\b/g) || [];

    if (sentences.length === 0 || words.length === 0) return 0;

    const totalWords = words.length;
    const totalSentences = sentences.length;
    const totalSyllables = (words as string[]).reduce((acc: number, word: string) => acc + countSyllables(word), 0);

    const avgWordsPerSentence = totalWords / totalSentences;
    const avgSyllablesPerWord = totalSyllables / totalWords;

    const grade = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
    return Math.max(0, Math.round(grade * 10) / 10);
}

export function fleschReadingEase(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.match(/\b\w+\b/g) || [];

    if (sentences.length === 0 || words.length === 0) return 100;

    const totalWords = words.length;
    const totalSentences = sentences.length;
    const totalSyllables = (words as string[]).reduce((acc: number, word: string) => acc + countSyllables(word), 0);

    const avgWordsPerSentence = totalWords / totalSentences;
    const avgSyllablesPerWord = totalSyllables / totalWords;

    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

export function getReadabilityLabel(grade: number): { label: string, color: string, emoji: string } {
    if (grade <= 6) return { label: "Very Easy", color: "#10B981", emoji: "✅" };
    if (grade <= 8) return { label: "Easy", color: "#0D9468", emoji: "👍" };
    if (grade <= 10) return { label: "Moderate", color: "#EAB308", emoji: "⚠️" };
    if (grade <= 12) return { label: "Difficult", color: "#F97316", emoji: "⚠️" };
    return { label: "Very Difficult", color: "#EF4444", emoji: "🔴" };
}

export function analyzeReadability(text: string) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.match(/\b\w+\b/g) || [];

    const totalWords = words.length;
    const totalSentences = sentences.length;
    const totalSyllables = (words as string[]).reduce((acc: number, word: string) => acc + countSyllables(word), 0);

    const grade = fleschKincaidGrade(text);
    const readingEase = fleschReadingEase(text);
    const labelData = getReadabilityLabel(grade);

    return {
        grade,
        readingEase,
        ...labelData,
        sentenceCount: totalSentences,
        wordCount: totalWords,
        avgSyllables: totalWords > 0 ? Math.round((totalSyllables / totalWords) * 100) / 100 : 0
    };
}
