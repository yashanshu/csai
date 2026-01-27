export const normalizeModelName = (value) => {
  if (value === "qwen3-9b") {
    return "qwen3:8b";
  }
  return value;
};
