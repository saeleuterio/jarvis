import {
  buscarHistorico,
  obterHistoricoCompleto,
} from "./src/memory/history.js";

const total = obterHistoricoCompleto().length;
const resultados = buscarHistorico("JavaScript Node.js");

console.log("Total de mensagens salvas:", total);
console.log("Resultados encontrados:", resultados.length);
console.log(JSON.stringify(resultados, null, 2));
