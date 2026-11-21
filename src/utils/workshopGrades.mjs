/**
 * Workshop grade ranges are stored as numeric minGrade/maxGrade (K = 0).
 * Keep the original text compatible with older catalogue documents, but
 * render one canonical label and filter by a student's actual grade.
 */
const validGrade = value => Number.isInteger(value) && value >= 0 && value <= 12;

export function parseGradeRange(value) {
  if (typeof value !== "string") return null;
  const label = value.trim().replace(/[\u2013\u2014\u2212]/g, "-").replace(/\s+/g, " ");
  const match = /^(?:grades?\s*)?(Kindergarten|K|1[0-2]|[0-9])\s*(?:(?:-|to|through|and|or|&|\/)\s*(?:grades?\s*)?(Kindergarten|K|1[0-2]|[0-9]))?$/i.exec(label);
  if (!match) return null;
  const minGrade = /^(?:k|kindergarten)$/i.test(match[1]) ? 0 : Number(match[1]);
  const maxGrade = match[2] ? (/^(?:k|kindergarten)$/i.test(match[2]) ? 0 : Number(match[2])) : minGrade;
  return validGrade(minGrade) && validGrade(maxGrade) && minGrade <= maxGrade
    ? { minGrade, maxGrade }
    : null;
}

export function getWorkshopGradeBounds(workshop = {}) {
  const min = validGrade(workshop?.minGrade) ? workshop.minGrade : null;
  const max = validGrade(workshop?.maxGrade) ? workshop.maxGrade : null;
  if (min !== null && max !== null && min <= max) {
    return { minGrade: min, maxGrade: max };
  }

  const parsed = parseGradeRange(workshop?.grade);
  if (parsed) return parsed;

  // Older partial records may have only one numeric bound.
  if (min !== null || max !== null) {
    const grade = min ?? max;
    return { minGrade: grade, maxGrade: grade };
  }
  return null;
}

function gradeName(grade) {
  return grade === 0 ? "Kindergarten" : `Grade ${grade}`;
}

export function formatWorkshopGradeRange(bounds) {
  if (!bounds) return "";
  const { minGrade, maxGrade } = bounds;
  if (!validGrade(minGrade) || !validGrade(maxGrade) || minGrade > maxGrade) return "";
  if (minGrade === maxGrade) return gradeName(minGrade);
  return minGrade === 0
    ? `Kindergarten - Grade ${maxGrade}`
    : `Grades ${minGrade} - ${maxGrade}`;
}

export function normalizeWorkshopGrades(workshop) {
  if (!workshop || typeof workshop !== "object") return workshop;
  const bounds = getWorkshopGradeBounds(workshop);
  if (!bounds) return workshop;
  return {
    ...workshop,
    grade: formatWorkshopGradeRange(bounds),
    minGrade: bounds.minGrade,
    maxGrade: bounds.maxGrade,
  };
}

export function workshopGradeOptions(workshops = []) {
  const values = new Set();
  for (const workshop of workshops) {
    const bounds = getWorkshopGradeBounds(workshop);
    if (!bounds) continue;
    for (let grade = bounds.minGrade; grade <= bounds.maxGrade; grade += 1) {
      values.add(grade);
    }
  }
  return [...values]
    .sort((a, b) => a - b)
    .map(grade => ({ value: String(grade), label: gradeName(grade) }));
}

export function matchesWorkshopGrade(workshop, selectedGrade) {
  if (selectedGrade === "all") return true;
  if (typeof selectedGrade !== "string" || !/^(?:0|[1-9]|1[0-2])$/.test(selectedGrade)) return false;
  const bounds = getWorkshopGradeBounds(workshop);
  const grade = Number(selectedGrade);
  return Boolean(bounds && bounds.minGrade <= grade && grade <= bounds.maxGrade);
}
