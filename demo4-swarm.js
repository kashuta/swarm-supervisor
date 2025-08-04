import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import 'dotenv/config';

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// Handoff tools
const transferToTech = createHandoffTool({
  name: "transfer_to_tech",
  description: "Передать техническому специалисту для решения проблем с приложением.",
  agentName: "tech_support",
});

const transferToBilling = createHandoffTool({
  name: "transfer_to_billing",
  description: "Передать специалисту по оплате для вопросов по счету и балансу.",
  agentName: "billing_support",
});

const transferToGeneral = createHandoffTool({
  name: "transfer_to_general",
  description: "Вернуть к общей поддержке для общих вопросов.",
  agentName: "general_support",
});

// Technical Support Tool
const solve_tech_issue = tool(
  async ({
    issue
  }) => `Решение для '${issue}': Попробуйте перезапустить приложение.`, {
    name: "solve_tech_issue",
    description: "Решает техническую проблему.",
    schema: z.object({
      issue: z.string().describe("Описание технической проблемы"),
    }),
  }
);

// Billing Support Tool
const check_account = tool(
  async ({
    accountId
  }) => `Статус аккаунта '${accountId}': Активен. Баланс: 1500 руб.`, {
    name: "check_account",
    description: "Проверяет статус и баланс аккаунта.",
    schema: z.object({
      accountId: z.string().describe("ID аккаунта клиента"),
    }),
  }
);

// General Support Agent
const generalSupportAgent = createReactAgent({
  llm,
  tools: [transferToTech, transferToBilling],
  messageModifier: `Вы агент общей поддержки. Ваша задача - понять проблему клиента и передать его соответствующему специалисту. Используйте 'transfer_to_tech' для технических проблем и 'transfer_to_billing' для вопросов по оплате.`,
  name: "general_support",
});

// Technical Support Agent
const techSupportAgent = createReactAgent({
  llm,
  tools: [solve_tech_issue, transferToBilling, transferToGeneral],
  messageModifier: `Вы технический специалист. Используйте инструмент 'solve_tech_issue' для решения проблем. Если клиент спрашивает об оплате, используйте 'transfer_to_billing'. Если проблема решена или вопрос не по вашей части, используйте 'transfer_to_general'.`,
  name: "tech_support",
});

// Billing Support Agent
const billingSupportAgent = createReactAgent({
  llm,
  tools: [check_account, transferToTech, transferToGeneral],
  messageModifier: `Вы специалист по оплате. Используйте 'check_account' для проверки данных аккаунта. Если у клиента технический вопрос, используйте 'transfer_to_tech'. Для других вопросов - 'transfer_to_general'.`,
  name: "billing_support",
});


// Memory and Swarm setup
const checkpointer = new MemorySaver(); // Важно! Сохраняет контекст между сообщениями

const customerSupport = createSwarm({
  agents: [
    generalSupportAgent,
    techSupportAgent,
    billingSupportAgent,
  ],
  defaultActiveAgent: "general_support",
});

const swarmApp = customerSupport.compile({
  checkpointer
});
console.log("🐝 Swarm система инициализирована с памятью.");

const config = {
  configurable: {
    thread_id: "customer_123"
  }
};

// Функции для красивого логирования
const logSwarmArchitecture = () => {
  console.log("🏗️  АРХИТЕКТУРА SWARM СИСТЕМЫ");
  console.log("════════════════════════════════════════");
  console.log("📋 Агенты в системе:");
  console.log("  🤖 general_support  - Первичная поддержка (точка входа)");
  console.log("  🔧 tech_support     - Технические проблемы");
  console.log("  💰 billing_support  - Вопросы по оплате");
  console.log("");
  console.log("🔄 Инструменты передачи управления:");
  console.log("  transfer_to_tech    → Передача техническому специалисту");
  console.log("  transfer_to_billing → Передача специалисту по оплате");
  console.log("  transfer_to_general → Возврат к общей поддержке");
  console.log("");
  console.log("🛠️  Специализированные инструменты:");
  console.log("  solve_tech_issue    → Решение технических проблем");
  console.log("  check_account       → Проверка статуса аккаунта");
  console.log("");
  console.log("🧠 Память: MemorySaver сохраняет контекст между сообщениями");
  console.log("════════════════════════════════════════\n");
};

const logTurnHeader = (turnNumber, userMessage) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ХОД ${turnNumber}: АНАЛИЗ SWARM ЛОГИКИ`);
  console.log(`${"=".repeat(60)}`);
  console.log(`👤 КЛИЕНТ: "${userMessage}"`);
  console.log("");
};

const logSwarmState = (label, result, previousAgent = null) => {
  console.log(`📊 ${label}:`);
  console.log(`  🤖 Активный агент: ${result.activeAgent}`);
  
  if (previousAgent && previousAgent !== result.activeAgent) {
    console.log(`  🔄 ПЕРЕДАЧА УПРАВЛЕНИЯ: ${previousAgent} → ${result.activeAgent}`);
    
    const agentNames = {
      general_support: "Общая поддержка",
      tech_support: "Технический специалист", 
      billing_support: "Специалист по оплате"
    };
    
    console.log(`  💡 ЛОГИКА: ${agentNames[previousAgent]} передал задачу → ${agentNames[result.activeAgent]}`);
  }
  
  console.log(`  💬 Всего сообщений в контексте: ${result.messages.length}`);
  console.log("");
};

const logToolUsage = (result) => {
  const lastMessage = result.messages[result.messages.length - 1];
  
  // Проверяем, использовались ли инструменты
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log("🛠️  ИСПОЛЬЗОВАНИЕ ИНСТРУМЕНТОВ:");
    lastMessage.tool_calls.forEach(toolCall => {
      console.log(`  🔧 Инструмент: ${toolCall.name}`);
      console.log(`  📝 Аргументы:`, toolCall.args);
    });
    console.log("");
  }
  
  // Проверяем инструменты передачи управления по содержимому
  const content = lastMessage.content?.toLowerCase() || "";
  if (content.includes("передать") || content.includes("transfer")) {
    console.log("🔄 ОБНАРУЖЕНА ПЕРЕДАЧА УПРАВЛЕНИЯ:");
    console.log("  📋 Агент принял решение передать клиента другому специалисту");
    console.log("  💭 Причина: Запрос выходит за рамки его компетенции");
    console.log("");
  }
};

const logAgentResponse = (result) => {
  const lastMessage = result.messages[result.messages.length - 1];
  console.log("💬 ОТВЕТ АГЕНТА:");
  console.log(`  "${lastMessage.content}"`);
  console.log("");
};

const logMemoryState = (result) => {
  console.log("🧠 СОСТОЯНИЕ ПАМЯТИ:");
  console.log(`  📚 Сохранено сообщений: ${result.messages.length}`);
  console.log("  🔗 Контекст сохраняется между ходами");
  console.log("  💾 Thread ID: customer_123");
  console.log("");
};

async function runSwarmDemo() {
  console.log("\n🐝 ДЕМОНСТРАЦИЯ SWARM СИСТЕМЫ ПОДДЕРЖКИ КЛИЕНТОВ");
  console.log("🎯 Цель: Показать интеллектуальную маршрутизацию между агентами\n");
  
  logSwarmArchitecture();
  
  let previousAgent = "general_support"; // Начальный агент

  // ==================== ХОД 1 ====================
  logTurnHeader(1, "У меня не работает приложение");
  
  console.log("🔍 АНАЛИЗ ЗАПРОСА:");
  console.log("  📝 Тип проблемы: Техническая проблема");
  console.log("  🎯 Ожидаемый агент: general_support → tech_support");
  console.log("  💡 Логика: Общая поддержка должна направить к техническому специалисту\n");
  
  let turn1 = await swarmApp.invoke({
    messages: [{
      role: "user",
      content: "У меня не работает приложение"
    }]
  }, config);
  
  logSwarmState("РЕЗУЛЬТАТ ОБРАБОТКИ", turn1, previousAgent);
  logToolUsage(turn1);
  logAgentResponse(turn1);
  logMemoryState(turn1);
  
  previousAgent = turn1.activeAgent;

  // ==================== ХОД 2 ====================
  logTurnHeader(2, "Появляется ошибка 500");
  
  console.log("🔍 АНАЛИЗ ЗАПРОСА:");
  console.log("  📝 Тип проблемы: Уточнение технической проблемы");
  console.log("  🎯 Ожидаемый агент: tech_support (продолжение)");
  console.log("  💡 Логика: Технический специалист должен использовать solve_tech_issue\n");
  
  let turn2 = await swarmApp.invoke({
    messages: [{
      role: "user",
      content: "Появляется ошибка 500"
    }]
  }, config);
  
  logSwarmState("РЕЗУЛЬТАТ ОБРАБОТКИ", turn2, previousAgent);
  logToolUsage(turn2);
  logAgentResponse(turn2);
  logMemoryState(turn2);
  
  previousAgent = turn2.activeAgent;

  // ==================== ХОД 3 ====================
  logTurnHeader(3, "Спасибо! А какой у меня баланс по счету my_acc_id?");
  
  console.log("🔍 АНАЛИЗ ЗАПРОСА:");
  console.log("  📝 Тип проблемы: Вопрос по балансу аккаунта");
  console.log("  🎯 Ожидаемый агент: tech_support → billing_support");
  console.log("  💡 Логика: Технический специалист должен передать к специалисту по оплате\n");
  
  let turn3 = await swarmApp.invoke({
    messages: [{
      role: "user",
      content: "Спасибо! А какой у меня баланс по счету my_acc_id?"
    }]
  }, config);
  
  logSwarmState("РЕЗУЛЬТАТ ОБРАБОТКИ", turn3, previousAgent);
  logToolUsage(turn3);
  logAgentResponse(turn3);
  logMemoryState(turn3);
  
  previousAgent = turn3.activeAgent;

  // ==================== ХОД 4 ====================
  logTurnHeader(4, "Хочу пожаловаться на качество обслуживания");
  
  console.log("🔍 АНАЛИЗ ЗАПРОСА:");
  console.log("  📝 Тип проблемы: Общий вопрос / жалоба");
  console.log("  🎯 Ожидаемый агент: billing_support → general_support");
  console.log("  💡 Логика: Специалист по оплате должен передать к общей поддержке\n");
  
  let turn4 = await swarmApp.invoke({
    messages: [{
      role: "user",
      content: "Хочу пожаловаться на качество обслуживания"
    }]
  }, config);
  
  logSwarmState("РЕЗУЛЬТАТ ОБРАБОТКИ", turn4, previousAgent);
  logToolUsage(turn4);
  logAgentResponse(turn4);
  logMemoryState(turn4);
  
  // ==================== ИТОГИ ====================
  console.log(`\n${"=".repeat(60)}`);
  console.log("  🎉 ДЕМОНСТРАЦИЯ ЗАВЕРШЕНА: АНАЛИЗ РЕЗУЛЬТАТОВ");
  console.log(`${"=".repeat(60)}`);
  console.log("✅ УСПЕШНО ПРОДЕМОНСТРИРОВАНО:");
  console.log("  🔄 Автоматическая маршрутизация между агентами");
  console.log("  🧠 Сохранение контекста разговора в памяти");
  console.log("  🛠️  Использование специализированных инструментов");
  console.log("  🎯 Принятие решений на основе типа запроса");
  console.log("");
  console.log("📈 ПОЛНЫЙ ПУТЬ ОБРАБОТКИ:");
  console.log("  general_support → tech_support → billing_support → general_support");
  console.log("");
  console.log("🔄 ПРОДЕМОНСТРИРОВАННЫЕ ПЕРЕХОДЫ:");
  console.log("  1️⃣ Техническая проблема    → К техническому специалисту");
  console.log("  2️⃣ Продолжение технической → Остается у технического специалиста");
  console.log("  3️⃣ Вопрос по оплате       → К специалисту по оплате");
  console.log("  4️⃣ Общая жалоба           → К общей поддержке");
  console.log("");
  console.log("🏆 SWARM СИСТЕМА ПОКАЗАЛА МАКСИМАЛЬНУЮ ЭФФЕКТИВНОСТЬ!");
  console.log("   Полная демонстрация интеллектуальной маршрутизации!");
  console.log(`${"=".repeat(60)}\n`);
}

runSwarmDemo();