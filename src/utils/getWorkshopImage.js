export function getWorkshopImage(category = "") {
  const normalizedCategory = category.toLowerCase();

  if (
    normalizedCategory.includes("technology") ||
    normalizedCategory.includes("digital") ||
    normalizedCategory.includes("coding")
  ) {
    return "/images/landing/youth-coding.png";
  }

  if (
    normalizedCategory.includes("trade") ||
    normalizedCategory.includes("construction")
  ) {
    return "/images/landing/youth-trades.png";
  }

  return "/images/landing/youth-campus.png";
}