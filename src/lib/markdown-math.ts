function countRun(value: string, index: number, character: string) {
  let cursor = index;
  while (value[cursor] === character) cursor += 1;
  return cursor - index;
}

function isEscaped(value: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function normalizeLine(
  line: string,
  inlineCodeTicks: number,
  hasClosingBackticks: (index: number, tickCount: number) => boolean,
) {
  let result = "";
  let cursor = 0;

  while (cursor < line.length) {
    if (line[cursor] === "`") {
      const tickCount = countRun(line, cursor, "`");
      if (inlineCodeTicks === 0 && !isEscaped(line, cursor) && hasClosingBackticks(cursor, tickCount)) {
        inlineCodeTicks = tickCount;
      }
      else if (tickCount === inlineCodeTicks) inlineCodeTicks = 0;
      result += line.slice(cursor, cursor + tickCount);
      cursor += tickCount;
      continue;
    }

    if (inlineCodeTicks === 0 && !isEscaped(line, cursor)) {
      const delimiter = line.slice(cursor, cursor + 2);
      if (delimiter === "\\(" || delimiter === "\\)") {
        result += "$";
        cursor += 2;
        continue;
      }
      if (delimiter === "\\[" || delimiter === "\\]") {
        result += "$$";
        cursor += 2;
        continue;
      }
    }

    result += line[cursor];
    cursor += 1;
  }

  return { inlineCodeTicks, result };
}

export function normalizeMathDelimiters(markdown: string) {
  let fenceMarker: "`" | "~" | null = null;
  let fenceLength = 0;
  let inlineCodeTicks = 0;
  const lines = markdown.split(/(\r?\n)/);

  return lines.map((line, lineIndex) => {
    if (/^\r?\n$/.test(line)) return line;
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);

    if (fence && inlineCodeTicks === 0) {
      const marker = fence[1][0] as "`" | "~";
      const length = fence[1].length;
      if (fenceMarker === null) {
        fenceMarker = marker;
        fenceLength = length;
        inlineCodeTicks = 0;
      } else if (marker === fenceMarker && length >= fenceLength && /^\s*$/.test(line.slice(fence[0].length))) {
        fenceMarker = null;
        fenceLength = 0;
      }
      return line;
    }

    if (fenceMarker !== null) return line;

    const normalized = normalizeLine(line, inlineCodeTicks, (index, tickCount) => {
      for (let nextLineIndex = lineIndex; nextLineIndex < lines.length; nextLineIndex += 1) {
        const nextLine = lines[nextLineIndex];
        const start = nextLineIndex === lineIndex ? index + tickCount : 0;
        for (let nextIndex = start; nextIndex < nextLine.length; nextIndex += 1) {
          if (nextLine[nextIndex] !== "`" || isEscaped(nextLine, nextIndex)) continue;
          if (countRun(nextLine, nextIndex, "`") === tickCount) return true;
        }
      }
      return false;
    });
    inlineCodeTicks = normalized.inlineCodeTicks;
    return normalized.result;
  }).join("");
}
