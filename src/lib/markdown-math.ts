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

function normalizeLine(line: string) {
  let result = "";
  let cursor = 0;
  let inlineCodeTicks = 0;

  while (cursor < line.length) {
    if (line[cursor] === "`") {
      const tickCount = countRun(line, cursor, "`");
      if (inlineCodeTicks === 0) inlineCodeTicks = tickCount;
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

  return result;
}

export function normalizeMathDelimiters(markdown: string) {
  let fenceMarker: "`" | "~" | null = null;
  let fenceLength = 0;

  return markdown.split(/(\r?\n)/).map((line) => {
    if (/^\r?\n$/.test(line)) return line;
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);

    if (fence) {
      const marker = fence[1][0] as "`" | "~";
      const length = fence[1].length;
      if (fenceMarker === null) {
        fenceMarker = marker;
        fenceLength = length;
      } else if (marker === fenceMarker && length >= fenceLength) {
        fenceMarker = null;
        fenceLength = 0;
      }
      return line;
    }

    return fenceMarker === null ? normalizeLine(line) : line;
  }).join("");
}
