import type { CodebaseContext, ExecutionPrompt, FileEditPlan } from "@/packages/schemas/project-blueprint.schema";

export interface ProviderExecutionResult {
  provider: string;
  mode: string;
  output: string;
}

export interface ProviderFileEditResult {
  provider: string;
  mode: string;
  output: string;
  plan: FileEditPlan;
}

export async function runCodingProvider(prompts: ExecutionPrompt[]): Promise<ProviderExecutionResult> {
  const provider = process.env.AI_AGENT_LLM_PROVIDER || "mock";
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return runOpenAIProvider(prompts);
  }
  
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    return runGeminiProvider(prompts);
  }

  return {
    provider,
    mode: "mock",
    output: [
      "Provider adapter đang chạy ở chế độ mock.",
      `Đã chuẩn bị ${prompts.length} prompt thực thi cho agent lập trình.`,
      "Đặt AI_AGENT_LLM_PROVIDER=openai và OPENAI_API_KEY để gọi provider thật."
    ].join("\n")
  };
}

export async function runFileEditProvider(input: {
  prompt: ExecutionPrompt;
  workspace: string;
  codebaseContext?: CodebaseContext;
  previousError?: string;
}): Promise<ProviderFileEditResult> {
  const provider = process.env.AI_AGENT_LLM_PROVIDER || "mock";

  if (process.env.AI_AGENT_STATIC_FILE_EDITS) {
    const plan = parseFileEditPlan(process.env.AI_AGENT_STATIC_FILE_EDITS);
    return {
      provider: "static",
      mode: "env",
      output: JSON.stringify(plan, null, 2),
      plan
    };
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return runOpenAIFileEditProvider(input);
  }

  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    return runGeminiFileEditProvider(input);
  }

  const plan: FileEditPlan = {
    summary: "Provider mock không đề xuất edit code. Hãy cấu hình OPENAI_API_KEY hoặc AI_AGENT_STATIC_FILE_EDITS.",
    edits: []
  };
  return {
    provider,
    mode: "mock",
    output: JSON.stringify(plan, null, 2),
    plan
  };
}

async function runOpenAIProvider(prompts: ExecutionPrompt[]): Promise<ProviderExecutionResult> {
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const input = [
    "Bạn là agent lập trình. Trả về kế hoạch triển khai ngắn gọn và nêu các file sẽ tạo hoặc sửa.",
    "",
    ...prompts.slice(0, 3).map((item, index) => [`Tác vụ ${index + 1}: ${item.title}`, item.prompt].join("\n"))
  ].join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input
    })
  });

  const data = (await response.json()) as {
    output_text?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI provider thất bại với trạng thái ${response.status}`);
  }

  return {
    provider: "openai",
    mode: model,
    output: data.output_text || JSON.stringify(data)
  };
}

async function runOpenAIFileEditProvider(input: {
  prompt: ExecutionPrompt;
  workspace: string;
  codebaseContext?: CodebaseContext;
  previousError?: string;
}): Promise<ProviderFileEditResult> {
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const providerInput = [
    "Bạn là agent lập trình.",
    "HÃY SUY NGHĨ TỪNG BƯỚC (Chain of Thought) BẰNG TIẾNG VIỆT TRƯỚC KHI CODE.",
    "Sau khi suy nghĩ xong, BẮT BUỘC trả về kế hoạch sửa file trong khối ```json",
    "Schema JSON:",
    '{"summary":"short summary","edits":[{"path":"relative/path","action":"create|overwrite|replace|append","content":"full content for create/overwrite/append","oldText":"text to replace","newText":"replacement text"}]}',
    "```",
    "",
    "Quy tắc:",
    "- Đường dẫn phải là tương đối so với workspace.",
    "- Không sửa .git, node_modules, .next, dist, build, coverage hoặc .ai-agent.",
    "- Ưu tiên edit dạng replace hơn overwrite.",
    "- Giữ edit tối thiểu.",
    "",
    `Workspace: ${input.workspace}`,
    input.codebaseContext
      ? [
          `Dấu hiệu framework: ${input.codebaseContext.frameworkSignals.join(", ")}`,
          `Ngôn ngữ: ${input.codebaseContext.languages.join(", ")}`,
          `File quan trọng: ${input.codebaseContext.keyFiles.slice(0, 60).join(", ")}`
        ].join("\n")
      : "Không có ngữ cảnh codebase hiện có.",
    input.previousError ? `Lỗi kiểm chứng trước đó:\n${input.previousError}` : "",
    "",
    "Prompt thực thi:",
    input.prompt.prompt
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: providerInput
    })
  });

  const data = (await response.json()) as {
    output_text?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI file edit provider thất bại với trạng thái ${response.status}`);
  }

  const output = data.output_text || JSON.stringify(data);
  return {
    provider: "openai",
    mode: model,
    output,
    plan: parseFileEditPlan(output)
  };
}

function parseFileEditPlan(output: string): FileEditPlan {
  let cleaned = output;
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    cleaned = jsonMatch[1];
  } else {
    // Nếu không có khối ```json, thử bóc tách từ dấu { đầu tiên đến dấu } cuối cùng
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = output.slice(start, end + 1);
    }
  }

  try {
    const parsed = JSON.parse(cleaned) as Partial<FileEditPlan>;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "Không có tóm tắt",
      edits: Array.isArray(parsed.edits) ? parsed.edits : []
    };
  } catch (err) {
    return {
      summary: "Lỗi parse JSON: " + (err instanceof Error ? err.message : String(err)),
      edits: []
    };
  }
}

async function runGeminiProvider(prompts: ExecutionPrompt[]): Promise<ProviderExecutionResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;
  const input = [
    ...prompts.slice(0, 3).map((item, index) => [`Tác vụ ${index + 1}: ${item.title}`, item.prompt].join("\n"))
  ].join("\n\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "Bạn là agent lập trình. Trả về kế hoạch triển khai ngắn gọn và nêu các file sẽ tạo hoặc sửa." }]
      },
      contents: [{
        parts: [{ text: input }]
      }]
    })
  });

  const data = await response.json() as any;

  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini provider thất bại với trạng thái ${response.status}`);
  }

  const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không có nội dung trả về từ Gemini.";

  return {
    provider: "gemini",
    mode: model,
    output
  };
}

async function runGeminiFileEditProvider(input: {
  prompt: ExecutionPrompt;
  workspace: string;
  codebaseContext?: CodebaseContext;
  previousError?: string;
}): Promise<ProviderFileEditResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;
  
  const systemPrompt = [
    "Bạn là agent lập trình.",
    "HÃY SUY NGHĨ TỪNG BƯỚC (Chain of Thought) BẰNG TIẾNG VIỆT TRƯỚC KHI CODE.",
    "Sau khi suy nghĩ xong, BẮT BUỘC trả về kế hoạch sửa file trong khối ```json",
    "Schema JSON:",
    '{"summary":"short summary","edits":[{"path":"relative/path","action":"create|overwrite|replace|append","content":"full content for create/overwrite/append","oldText":"text to replace","newText":"replacement text"}]}',
    "```",
    "",
    "Quy tắc:",
    "- Đường dẫn phải là tương đối so với workspace.",
    "- Không sửa .git, node_modules, .next, dist, build, coverage hoặc .ai-agent.",
    "- Ưu tiên edit dạng replace hơn overwrite.",
    "- Giữ edit tối thiểu."
  ].join("\n");

  const userPrompt = [
    `Workspace: ${input.workspace}`,
    input.codebaseContext
      ? [
          `Dấu hiệu framework: ${input.codebaseContext.frameworkSignals.join(", ")}`,
          `Ngôn ngữ: ${input.codebaseContext.languages.join(", ")}`,
          `File quan trọng: ${input.codebaseContext.keyFiles.slice(0, 60).join(", ")}`
        ].join("\n")
      : "Không có ngữ cảnh codebase hiện có.",
    input.previousError ? `Lỗi kiểm chứng trước đó:\n${input.previousError}` : "",
    "",
    "Prompt thực thi:",
    input.prompt.prompt
  ].join("\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: userPrompt }]
      }]
    })
  });

  const data = await response.json() as any;

  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini file edit provider thất bại với trạng thái ${response.status}`);
  }

  const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"summary":"Empty response","edits":[]}';
  
  return {
    provider: "gemini",
    mode: model,
    output,
    plan: parseFileEditPlan(output)
  };
}
