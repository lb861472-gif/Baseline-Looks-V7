import { createSupabaseContext } from "npm:@supabase/server";

const MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_PROMPT = 30000;
const MAX_IMAGES = 2;
const MAX_IMAGE_CHARS = 8_000_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "POST requests only." }, 405);
  }

  // The app authenticates the user with Supabase. The user never supplies
  // a Gemini key; the Gemini credential stays in this Edge Function secret.
  const { data: ctx, error: authError } = await createSupabaseContext(req, {
    auth: "user",
  });

  if (authError || !ctx?.userClaims?.sub) {
    return json({ error: "Please sign in before running your Baseline analysis." }, 401);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    console.error("Missing GEMINI_API_KEY Edge Function secret.");
    return json({
      error: "Baseline AI is not configured yet. Add the GEMINI_API_KEY secret in Supabase Edge Functions.",
      code: "AI_NOT_CONFIGURED",
    }, 503);
  }

  let body: {
    prompt?: string;
    images?: Array<{ mime_type: string; data: string }>;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const prompt = String(body.prompt || "").trim();

  if (!prompt || prompt.length > MAX_PROMPT) {
    return json({ error: "Invalid or oversized analysis request." }, 400);
  }

  const images = Array.isArray(body.images)
    ? body.images.slice(0, MAX_IMAGES)
    : [];

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  for (const image of images) {
    if (!image?.data) continue;

    const mimeType = String(image.mime_type || "");
    const data = String(image.data);

    if (!mimeType.startsWith("image/")) continue;
    if (data.length > MAX_IMAGE_CHARS) {
      return json({ error: "One of the photos is too large. Please choose a smaller photo." }, 413);
    }

    parts.push({
      inline_data: {
        mime_type: mimeType,
        data,
      },
    });
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts,
        }],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini request failed:", response.status, data);

      if (response.status === 401 || response.status === 403) {
        return json({
          error: "Baseline AI could not authenticate with its AI service. Check the GEMINI_API_KEY secret.",
          code: "AI_AUTH_FAILED",
        }, 502);
      }

      if (response.status === 429) {
        return json({
          error: "Baseline AI is temporarily at its free-tier usage limit. Please try again later.",
          code: "AI_RATE_LIMITED",
        }, 429);
      }

      return json({
        error: data?.error?.message || "The AI service returned an error.",
        code: "AI_PROVIDER_ERROR",
      }, 502);
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      console.error("Gemini returned no text:", data);
      return json({
        error: "The AI service returned an empty response.",
        code: "AI_EMPTY_RESPONSE",
      }, 502);
    }

    return json({
      text,
      userId: ctx.userClaims.sub,
    });
  } catch (error) {
    console.error("Gemini network error:", error);
    return json({
      error: "Baseline could not reach the AI service. Please try again.",
      code: "AI_NETWORK_ERROR",
    }, 502);
  }
});
