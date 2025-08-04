import "dotenv/config";
import { END, START, StateGraph } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// State
const workflowState = {
  messages: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
};

// Tools
const researchTool = tool(
  async ({ topic }) => {
    const mockData = {
      LangGraph: JSON.stringify([
        "факт 1 о LangGraph",
        "факт 2 о LangGraph",
        "факт 3 о LangGraph",
      ]),
      "мультиагентные системы": JSON.stringify([
        "преимущество 1 мультиагентных систем",
        "преимущество 2 мультиагентных систем",
      ]),
    };
    return mockData[topic] || "Информации по этой теме не найдено.";
  },
  {
    name: "research",
    description: "Searches for information on a given topic.",
    schema: z.object({
      topic: z.string().describe("The topic to research."),
    }),
  }
);
console.log("🛠️  Инструмент исследователя (researchTool) создан");

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });


// Agents
const researchAgent = createReactAgent({
  llm,
  tools: [researchTool],
  prompt:
    "Ты — ИИ-ассистент, выполняющий роль исследователя. Твоя задача — находить самую свежую и релевантную информацию по заданной теме. Используй доступные инструменты для поиска данных. После сбора информации выдели ключевые факты и структурируй их в виде списка.",
});
console.log("🤖 Создан исследовательский агент (researchAgent)");

const writerAgent = createReactAgent({
  llm,
  tools: [],
  prompt:
    "Ты — ИИ-ассистент, выполняющий роль технического писателя. Твоя задача — на основе предоставленных фактов написать техническую статью. Статья должна быть четкой, лаконичной и хорошо структурированной. Стиль изложения — профессиональный, но понятный для широкой аудитории. Не добавляй ничего от себя, используй только предоставленные факты.",
});
console.log("🤖 Создан агент-писатель (writerAgent)");

const editorAgent = createReactAgent({
  llm,
  tools: [],
  prompt:
    "Ты — ИИ-ассистент, выполняющий роль редактора. Твоя задача — проверить и отредактировать предоставленную статью. Убедись, что текст написан без ошибок, логичен и соответствует фактам. При необходимости улучши стиль и форматирование, чтобы сделать статью более читабельной.",
});
console.log("🤖 Создан агент-редактор (editorAgent)");

// Nodes
const researchNode = async (state) => {
  console.log("🔍 Исследователь начал работу...");
  const result = await researchAgent.invoke({
    messages: [new HumanMessage("Исследуй тему: мультиагентные системы")],
  });
  console.log("🔍 Исследователь закончил работу.");
  return { messages: result.messages };
};

const writerNode = async (state) => {
  console.log("✍️ Писатель создаёт статью...");
  const result = await writerAgent.invoke(state);
  console.log("✍️ Писатель закончил работу.");
  return { messages: result.messages };
};

const editorNode = async (state) => {
  console.log("📝 Редактор проверяет текст...");
  const result = await editorAgent.invoke(state);
  console.log("📝 Редактор закончил работу.");
  return { messages: result.messages };
};

// Graph
const workflow = new StateGraph({ channels: workflowState });

workflow.addNode("researcher", researchNode);
workflow.addNode("writer", writerNode);
workflow.addNode("editor", editorNode);

workflow.addEdge(START, "researcher");
workflow.addEdge("researcher", "writer");
workflow.addEdge("writer", "editor");
workflow.addEdge("editor", END);

const app = workflow.compile();
console.log("✅ Граф успешно скомпилирован!");

const runSequentialDemo = async () => {
  console.log("\n🚀 Запускаем последовательную мультиагентную систему\n");
  try {
    const result = await app.invoke({
      messages: [],
    });
    console.log("\n📄 Финальная статья:");
    console.log(result.messages.slice(-1)[0].content);
  } catch (e) {
    console.error(e);
  }
};

runSequentialDemo();
