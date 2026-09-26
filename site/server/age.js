// Birthday boundaries follow Heidi's Eastern business time zone.
export function easternDate(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
export function adultBirthday(birthDate) {
  const [year, month, day] = String(birthDate)
    .slice(0, 10)
    .split("-")
    .map(Number);
  const lastDay = new Date(Date.UTC(year + 18, month, 0)).getUTCDate();
  return `${year + 18}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
export function isAdult(birthDate, on = easternDate()) {
  return on >= adultBirthday(birthDate);
}
