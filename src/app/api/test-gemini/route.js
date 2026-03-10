// Diagnostic endpoint to test Gemini API key and connectivity
export async function GET(request) {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        success: false,
        error: "API_KEY_MISSING",
        message: "NEXT_PUBLIC_GEMINI_API_KEY not set in environment",
      },
      { status: 500 },
    );
  }

  try {
    // Test if the API key is valid by making a simple request
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1alpha/models/gemini-2.5-flash-native-audio-preview-12-2025:streamGenerateContent?alt=sse",
      {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status === 401) {
      return Response.json(
        {
          success: false,
          error: "INVALID_API_KEY",
          message:
            "API key is invalid, expired, or does not have permission to access this model",
          httpStatus: 401,
        },
        { status: 401 },
      );
    }

    if (response.status === 403) {
      return Response.json(
        {
          success: false,
          error: "PERMISSION_DENIED",
          message:
            "API key does not have access to gemini-2.5-flash-native-audio-preview-12-2025 model. This is a restricted preview model.",
          httpStatus: 403,
        },
        { status: 403 },
      );
    }

    if (response.status === 429) {
      return Response.json(
        {
          success: false,
          error: "QUOTA_EXHAUSTED",
          message: "API quota exhausted. Please check Google Cloud billing.",
          httpStatus: 429,
        },
        { status: 429 },
      );
    }

    // If we get here without error, the key seems valid
    return Response.json(
      {
        success: true,
        message:
          "API key appears valid and model is accessible. If you still see connection errors, check: 1) Browser console for detailed error 2) Network tab for WebSocket handshake response",
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        httpStatus: response.status,
      },
      { status: 200 },
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "CONNECTION_ERROR",
        message: `Failed to test API: ${error.message}`,
      },
      { status: 500 },
    );
  }
}
