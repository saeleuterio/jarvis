import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARQUIVO_HISTORICO = path.join(__dirname, "historico.json");

// Limite de mensagens usado como contexto recente para o Gemini.
const MAX_MENSAGENS_CONTEXTO = 20;

function garantirArquivo() {
  if (!fs.existsSync(ARQUIVO_HISTORICO)) {
    fs.writeFileSync(
      ARQUIVO_HISTORICO,
      JSON.stringify({ mensagens: [] }, null, 2),
      "utf8",
    );
  }
}

// Retorna todo o histórico armazenado.
export function obterHistoricoCompleto() {
  garantirArquivo();

  const conteudo = fs.readFileSync(ARQUIVO_HISTORICO, "utf8");
  const dados = JSON.parse(conteudo);

  if (!dados || !Array.isArray(dados.mensagens)) {
    throw new Error(
      "O arquivo historico.json possui uma estrutura inválida. Verifique o backup antes de continuar.",
    );
  }

  return dados.mensagens;
}

// Retorna somente as mensagens recentes para o contexto do Gemini.
export function obterHistorico() {
  return obterHistoricoCompleto().slice(-MAX_MENSAGENS_CONTEXTO);
}

export function registrarInteracao(pergunta, resposta) {
  if (
    typeof pergunta !== "string" ||
    typeof resposta !== "string" ||
    !pergunta.trim() ||
    !resposta.trim()
  ) {
    throw new Error("Pergunta e resposta precisam ser textos válidos.");
  }

  const mensagens = obterHistoricoCompleto();

  mensagens.push(
    {
      role: "user",
      parts: [{ text: pergunta }],
      data: new Date().toISOString(),
    },
    {
      role: "model",
      parts: [{ text: resposta }],
      data: new Date().toISOString(),
    },
  );

  const dados = { mensagens };
  const arquivoTemporario = `${ARQUIVO_HISTORICO}.tmp`;

  fs.writeFileSync(arquivoTemporario, JSON.stringify(dados, null, 2), "utf8");

  fs.renameSync(arquivoTemporario, ARQUIVO_HISTORICO);
}
