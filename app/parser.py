import re
import os
from typing import List, Dict, Optional


class WordEntry:
    def __init__(self, original_text: str, file_path: str, line_index: int):
        self.original_text = original_text
        self.file_path = file_path
        self.line_index = line_index
        self.is_marked = "[x]" in original_text
        self.german = ""
        self.translations = ""
        self.explanation = ""
        self.example = ""
        self.parse()

    def parse(self):
        # Split into front (word + grammar + translation) and back (explanation)
        parts = self.original_text.split(" - ", 1)
        front = parts[0]
        if len(parts) > 1:
            self.explanation = parts[1].strip()

        # Extract German word (between **)
        de_match = re.search(r"\*\*(.*?)\*\*", front)
        if de_match:
            self.german = de_match.group(1).strip()

        # Extract parenthetical contents from the front part only
        matches = re.findall(r"\((.*?)\)", front)
        if matches:
            best_candidate = ""
            max_score = -100

            for m in matches:
                m_strip = m.strip()
                score = 0

                # Indicator 1: Cyrillic characters (very strong sign of translation)
                if re.search(r"[а-яА-ЯёЁ]", m_strip):
                    score += 20

                # Indicator 2: Slash (common in bilingual translations)
                if "/" in m_strip:
                    score += 10

                # Indicator 3: Length (exclude short notes like Sg., Pl., Dat.)
                if len(m_strip) > 5:
                    score += 5

                # Penalty 1: German conjugation markers (hat, ist, comma-separated verbs)
                if re.search(r"\b(hat|ist)\b", m_strip):
                    score -= 15
                if m_strip.count(",") >= 2:
                    score -= 10

                if score > max_score:
                    max_score = score
                    best_candidate = m_strip

            self.translations = best_candidate
        elif not self.german and "**" not in self.original_text:
            # Fallback for lines that don't follow the bold pattern
            pass

    def set_example(self, example_text: str):
        self.example = example_text.replace("- *Beispiel:*", "").replace("\t", "").strip()


def get_words(file_paths: List[str]) -> List[WordEntry]:
    words = []
    for file_path in file_paths:
        if not os.path.exists(file_path):
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for i, line in enumerate(lines):
            if line.strip().startswith("- [ ]") or line.strip().startswith("- [x]"):
                entry = WordEntry(line, file_path, i)
                if i + 1 < len(lines) and (
                        lines[i + 1].strip().startswith("- *Beispiel:*") or lines[i + 1].strip().startswith(
                        "*Beispiel:*")):
                    entry.set_example(lines[i + 1])
                elif i + 1 < len(lines) and lines[i + 1].startswith("\t-"):
                    entry.set_example(lines[i + 1])

                words.append(entry)
    return words


def mark_word_as_learned(file_path: str, line_index: int):
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    if line_index < len(lines):
        lines[line_index] = lines[line_index].replace("- [ ]", "- [x]", 1)

    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
