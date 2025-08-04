import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { log, logAgent, logDivider } from "./utils/logger.js";

// Безопасная функция для вычисления математических выражений
function evaluateExpression(expression) {
  try {
    // Используем конструктор Function для безопасного выполнения кода
    // Это более безопасно, чем eval(), так как код выполняется в своей собственной области видимости
    return new Function(`return ${expression}`)();
  } catch (error) {
    // Перехватываем и логируем возможные синтаксические ошибки
    logAgent("Tool:Calculator", `Ошибка при вычислении выражения: '${expression}': ${error.message}`);
    // Возвращаем сообщение об ошибке, которое агент может обработать
    return `Ошибка: Некорректное выражение '${expression}'.`;
  }
}

const getCurrentTime = tool(() => {
    const time = new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    });
    logAgent("Tool:getCurrentTime", `Текущее время: ${time}`);
    return `Текущее время: ${time}`;
}, {
    name: "getCurrentTime",
    description: "Возвращает текущее время.",
    schema: z.object({})
});

const calculator = tool(({ expression }) => {
    const result = evaluateExpression(expression);
    logAgent("Tool:Calculator", `Результат выражения '${expression}': ${result}`);
    return `Результат: ${result}`;
}, {
    name: "calculator",
    description: "Вычисляет математическое выражение. Может обрабатывать сложение, вычитание, умножение и деление.",
    schema: z.object({
        expression: z.string().describe("Математическое выражение для вычисления, например '10 + 5 * (8 / 4)'")
    })
});

const model = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0,
});

const assistantAgent = createReactAgent({
  llm: model,
  tools: [getCurrentTime, calculator]
});

async function testBasicAgent() {
    logDivider();
    log("🤖", "Тестируем базового агента...");

    const question = "Который час? И сколько будет 25 * 37?";
    log("❓", `Вопрос: ${question}`);

    // Используем new HumanMessage для корректного формата
    const initialState = { messages: [new HumanMessage({ content: question })] };
    const stream = await assistantAgent.stream(initialState, { streamMode: "debug" });

    for await (const chunk of stream) {
        if (chunk.type === 'task_result' && chunk.payload.name === 'agent' && chunk.payload.result) {
            const messages = chunk.payload.result[0][1];
            for (const message of messages) {
                if (message.kwargs.additional_kwargs && message.kwargs.additional_kwargs.tool_calls) {
                    logAgent("🤔 Agent", "Решил использовать инструменты:");
                    message.kwargs.additional_kwargs.tool_calls.forEach(call => {
                        logAgent("   ", `-> Инструмент: '${call.function.name}', Аргументы: ${call.function.arguments}`);
                    });
                } else if (message.kwargs.content) {
                    log("✅", `Финальный ответ агента: ${message.kwargs.content}`);
                }
            }
        } else if (chunk.type === 'task_result' && chunk.payload.name === 'tools' && chunk.payload.result) {
            const messages = chunk.payload.result[0][1];
            for (const message of messages) {
                logAgent("🛠️ Tool", `Результат от '${message.kwargs.name}': ${message.kwargs.content}`);
            }
        }
    }
    logDivider();
}

testBasicAgent();
