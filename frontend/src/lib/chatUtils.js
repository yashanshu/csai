export const formatTimestamp = (value) => {
  if (!value) {
    return "";
  }
  const date =
    typeof value.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : null;
  if (!date) {
    return "";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const truncateText = (value, maxLength = 120) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  if (maxLength <= 3) {
    return trimmed.slice(0, maxLength);
  }
  return `${trimmed.slice(0, maxLength - 3)}...`;
};

export const createChatTitle = (value) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "Untitled chat";
  }
  const words = trimmed.split(/\s+/).slice(0, 6).join(" ");
  return truncateText(words, 48) || "Untitled chat";
};
