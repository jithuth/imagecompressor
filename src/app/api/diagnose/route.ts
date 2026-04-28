import { NextResponse } from 'next/server';

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const hfToken = process.env.HF_TOKEN?.trim();
  const results: Record<string, any> = {};

  // Test Gemini - list available models
  if (geminiKey && !geminiKey.includes('your_')) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      const data = await r.json();
      if (r.ok) {
        // Filter for vision-capable models
        const visionModels = data.models?.filter((m: any) =>
          m.supportedGenerationMethods?.includes('generateContent') &&
          (m.name.includes('flash') || m.name.includes('pro') || m.name.includes('vision'))
        ).map((m: any) => m.name);
        results.gemini = { status: r.status, availableModels: visionModels };
      } else {
        results.gemini = { status: r.status, error: data.error?.message };
      }
    } catch (e: any) {
      results.gemini = { error: e.message };
    }
  } else {
    results.gemini = { error: 'No GEMINI_API_KEY or key is placeholder' };
  }

  // Test Hugging Face token validity
  if (hfToken && !hfToken.includes('your_')) {
    try {
      const r = await fetch('https://huggingface.co/api/whoami', {
        headers: { Authorization: `Bearer ${hfToken}` }
      });
      const data = await r.json();
      results.huggingFace = { status: r.status, user: data.name || data.error };
    } catch (e: any) {
      results.huggingFace = { error: e.message };
    }
  } else {
    results.huggingFace = { error: 'No HF_TOKEN or token is placeholder' };
  }

  return NextResponse.json(results, { status: 200 });
}
