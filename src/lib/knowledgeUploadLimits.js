export const KNOWLEDGE_UPLOAD_LIMITS = {
  maxFilesPerRequest: 5,
  maxFileSizeBytes: 10 * 1024 * 1024,
};

export function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const value = size >= 10 ? Math.round(size) : Number(size.toFixed(1));
  return `${value} ${units[unitIndex]}`;
}

export function validateKnowledgeFiles(files) {
  const normalizedFiles = Array.from(files || []);

  if (!normalizedFiles.length) {
    return {
      isValid: false,
      errors: ["At least one PDF file is required"],
      acceptedFiles: [],
    };
  }

  const errors = [];
  const acceptedFiles = normalizedFiles.filter((file) => {
    if (!(file instanceof File) || file.type !== "application/pdf") {
      errors.push(`'${file?.name || "Unknown file"}' is not a PDF`);
      return false;
    }

    if (file.size > KNOWLEDGE_UPLOAD_LIMITS.maxFileSizeBytes) {
      errors.push(
        `'${file.name}' exceeds ${formatBytes(KNOWLEDGE_UPLOAD_LIMITS.maxFileSizeBytes)}`,
      );
      return false;
    }

    return true;
  });

  if (acceptedFiles.length > KNOWLEDGE_UPLOAD_LIMITS.maxFilesPerRequest) {
    errors.push(
      `You can upload at most ${KNOWLEDGE_UPLOAD_LIMITS.maxFilesPerRequest} PDFs at a time`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    acceptedFiles: acceptedFiles.slice(
      0,
      KNOWLEDGE_UPLOAD_LIMITS.maxFilesPerRequest,
    ),
  };
}
