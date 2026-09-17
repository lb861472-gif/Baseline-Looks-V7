import { createSupabaseContext } from "npm:@supabase/server";

const MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_PROMPT = 30000;
const MAX_IMAGES = 2;

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

  const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: "user" });
  if (authError) {
    return json({ error: "Authentication required." }, authError.status || 401);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return json({ error: "The Baseline AI service is not configured yet." }, 503);
  }

  let body: { prompt?: string; images?: Array<{ mime_type: string; data: string }> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const prompt = String(body.prompt || "").trim();
  if (!prompt || prompt.length > MAX_PROMPT) {
    return json({ error: "Invalid or oversized prompt." }, 400);
  }

  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  for (const image of images) {
    if (!image?.data || !String(image.mime_type || "").startsWith("image/")) continue;
    // Keep each request bounded. Base64 is approximately 4/3 the source size.
    if (String(image.data).length > 8_000_000) continue;
    parts.push({
      inline_data: {
        mime_type: image.mime_type,
        data: image.data,
      },
    });
  }

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini request failed:", response.status);
    return json({
      error: data?.error?.message || "The AI service returned an error."
    }, response.status);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    return json({ error: "The AI service returned an empty response." }, 502);
  }

  return json({ text, userId: ctx.userClaims?.sub });
});
