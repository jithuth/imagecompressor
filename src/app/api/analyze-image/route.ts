import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (!geminiKey || geminiKey.includes('your_')) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is missing in .env.local.' }, { status: 500 });
  }

  try {
    const { image, mimeType, usp } = await req.json();
    if (!image) return NextResponse.json({ error: 'No image provided.' }, { status: 400 });

    const base64Data = image.includes(",") ? image.split(",")[1] : image;

    const uspSection = usp
      ? `\n\nThe seller has provided these Unique Selling Points (USPs) about this product/image — you MUST incorporate them naturally into the short description, long description, and SEO content:\n"${usp}"`
      : '';

    const prompt = `You are an expert content writer for online marketplaces and digital platforms.
Analyze this image and generate compelling, sales-driven listing content.${uspSection}
Respond with ONLY a valid raw JSON object using these exact keys:
{
  "shortDescription": "A punchy 1-2 sentence hook that grabs attention, describes the image, and highlights the key USP if provided.",
  "longDescription": "A detailed 3-5 sentence listing description. Mention key visual details, mood, style, ideal use cases, and weave in any USPs naturally. Written to persuade and inform a buyer.",
  "seoTitle": "An SEO and marketplace-optimized title under 60 characters. Include main subject and style keywords.",
  "seoDescription": "An SEO meta description under 160 characters optimized for search and platform discovery.",
  "seoAltText": "A descriptive, keyword-rich alt text for accessibility and SEO."
}
No markdown, no backticks, no explanation — ONLY the raw JSON.`;

    // Models ordered from cheapest/highest-quota to most capable
    const models = [
      'gemini-2.0-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash',
    ];

    for (const model of models) {
      console.log(`Trying model: ${model}...`);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Data } }
                ]
              }]
            }),
          }
        );

        const result = await response.json();

        if (response.status === 429) {
          console.warn(`${model} quota exceeded, trying next...`);
          continue; // Try next model
        }

        if (!response.ok) {
          console.warn(`${model} failed (${response.status}):`, result.error?.message);
          continue; // Try next model
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          console.warn(`${model} returned empty text, trying next...`);
          continue;
        }

        console.log(`✅ Success with model: ${model}`);
        const cleanJson = text.replace(/```json\n?|\n?```/gi, '').trim();

        try {
          return NextResponse.json(JSON.parse(cleanJson));
        } catch {
          // If JSON parsing fails, build response from raw text
          return NextResponse.json({
            shortDescription: text.substring(0, 150).trim() + ".",
            longDescription: text,
            seoTitle: "Image Analysis | Asset",
            seoDescription: text.substring(0, 160).trim(),
            seoAltText: text.substring(0, 100).trim()
          });
        }

      } catch (e) {
        console.warn(`${model} threw error:`, e);
        continue;
      }
    }

    return NextResponse.json({ 
      error: 'All Gemini models have exceeded their free tier quota. Please wait a few minutes and try again, or check your API key at https://ai.dev/rate-limit.' 
    }, { status: 429 });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
