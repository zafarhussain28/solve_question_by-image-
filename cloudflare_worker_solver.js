export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return new Response("Send POST with JSON containing 'question'.", {
        status: 400,
        headers,
      });
    }

    // Read JSON
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON body.", {
        status: 400,
        headers,
      });
    }

    const question = body.question;

    if (!question || typeof question !== "string") {
      return new Response("Missing 'question' field.", {
        status: 400,
        headers,
      });
    }

    try {
      const solved = await runLlamaSolver(question, env);
      return new Response(solved, { status: 200, headers });
    } catch (e) {
      return new Response("Solver error: " + e.message, {
        status: 500,
        headers,
      });
    }
  },
};

/* ------------------------------------------------------
   Cloudflare LLaMA-3.1-70B Solver (Fully Fixed)
------------------------------------------------------ */

async function runLlamaSolver(question, env) {
  const model = "@cf/meta/llama-3.1-70b-instruct";

  // Solver instructions
  const prompt = `
You are a UNIVERSAL STEM SOLVER for Mathematics, Physics, and Chemistry.

You are given a clean problem statement. Solve it correctly and concisely.

STRICT OUTPUT FORMAT:

QUESTION:
${question}

SUBJECT:
Physics / Chemistry / Math

KEY IDEA:
1–2 sentence explanation only.

STEPS:
Step 1:
$$ <one equation> $$

Step 2:
$$ <one equation> $$

(Add steps if needed. One equation per step only.)

ANSWER:
Final Answer:
- <final numeric value with units OR final expression>
- If MCQ: Correct Option (A/B/C/D)

RULES:
- Do NOT show chain-of-thought.
- Do NOT explain in paragraphs.
- Do NOT rewrite diagrams.
- ONLY solve the CLEAN QUESTION passed to you.
- ALL equations must be inside $$ $$.
- NEVER fabricate formulas.
  `;

  const input = {
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 1500,
    temperature: 0.1,
  };

  const result = await env.AI.run(model, input);

  // New API format
  if (result?.response) {
    return result.response.trim();
  }

  // Old API fallback
  try {
    return result.messages[0].content[0].text.trim();
  } catch (e) {
    return "Unexpected AI format:\n" + JSON.stringify(result, null, 2);
  }
}
