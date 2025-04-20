import { NextResponse } from "next/server";

// Ensure we’re using the Node runtime so server‑side env vars are available.
export const runtime = "nodejs";

/**
 * POST /api/analyze-image
 * Body: { image: string }  // base‑64 PNG/JPEG (NO data‑URL prefix)
 * Returns: raw CSV text (text/plain)
 */
export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server missing OPENAI_API_KEY; set it in .env.local and restart" },
        { status: 500 }
      );
    }

    /* ---------------- OpenAI request ------------------- */
    const body = {
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 1024,
      response_format: { type: "text" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert inventory assistant. Extract every item you see in the image I send. " +
            "Return ONLY a CSV (no code fences) with columns: name,quantity,unit,category. " +
            "If a field is unknown, leave it blank. Use a single header row exactly as given.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${image}` },
            },
          ],
        },
      ],
    } as const;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return NextResponse.json({ error: txt }, { status: aiResp.status });
    }

    const data = await aiResp.json();
    const csv = (data.choices?.[0]?.message?.content ?? "").replace(
      /```[^]*?```/g,
      (s: string) => s.slice(3, -3)
    ); // strip any accidental code fences

    return new NextResponse(csv, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
