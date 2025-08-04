export function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

export function logAgent(agentName, message) {
  console.log(`[${agentName}] ${message}`);
}

export function logDivider() {
  console.log("\\n" + "=".repeat(50) + "\\n");
}
