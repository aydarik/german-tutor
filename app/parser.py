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
        # Improved split logic to avoid splitting inside bold tags or parentheses
        bold_start = self.original_text.find("**")
        bold_end = self.original_text.find("**", bold_start + 2) if bold_start != -1 else -1

        if bold_end != -1:
            search_start = bold_end + 2
            # Check for parentheses after bold part (translations often contain hyphens)
            parens_start = self.original_text.find("(", search_start)
            parens_end = self.original_text.find(")", parens_start) if parens_start != -1 else -1

            if parens_end != -1:
                search_start = parens_end + 1

            sep_idx = self.original_text.find(" - ", search_start)
            if sep_idx != -1:
                front = self.original_text[:sep_idx]
                self.explanation = self.original_text[sep_idx + 3:].strip()
            else:
                front = self.original_text
        else:
            # Fallback for lines without bold formatting
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
                # Look ahead for example (could be on the next line or the one after if there's a Grammar note)
                for j in range(1, 3):
                    if i + j < len(lines):
                        next_line = lines[i + j].strip()
                        if next_line.startswith("- *Beispiel:*") or next_line.startswith("*Beispiel:*"):
                            entry.set_example(lines[i + j])
                            break
                        elif j == 1 and lines[i + j].startswith("\t-"):
                            # If the very next line is an indented bullet but doesn't say "Beispiel", 
                            # we still set it as a fallback, but keep looking for a better one
                            entry.set_example(lines[i + j])

                words.append(entry)
    return words


def mark_word_as_learned(file_path: str, line_index: int):
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    if line_index < len(lines):
        lines[line_index] = lines[line_index].replace("- [ ]", "- [x]", 1)

    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
