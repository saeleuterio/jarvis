import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARQUIVO_HISTORICO = path.join(__dirname, "historico.json");

// Limite de mensagens utilizadas no contexto recente do Gemini.
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

// Retorna somente as mensagens recentes para o Gemini.
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

// Normaliza textos para facilitar a pesquisa.
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Transforma mensagens consecutivas em conversas completas.
function agruparConversas(mensagens) {
  const conversas = [];

  for (let i = 0; i < mensagens.length; i++) {
    const atual = mensagens[i];
    const proxima = mensagens[i + 1];

    // Agrupa uma pergunta do usuário com a resposta seguinte do JARVIS.
    if (atual.role === "user" && proxima && proxima.role === "model") {
      const pergunta = (atual.parts ?? [])
        .map((parte) => parte.text ?? "")
        .join(" ");

      const resposta = (proxima.parts ?? [])
        .map((parte) => parte.text ?? "")
        .join(" ");

      conversas.push({
        pergunta,
        resposta,
        data: atual.data ?? null,
      });

      i++;
      continue;
    }

    // Preserva mensagens isoladas, caso existam.
    const texto = (atual.parts ?? [])
      .map((parte) => parte.text ?? "")
      .join(" ");

    conversas.push({
      pergunta: atual.role === "user" ? texto : "",
      resposta: atual.role === "model" ? texto : "",
      data: atual.data ?? null,
    });
  }

  return conversas;
}

// Pesquisa e retorna conversas agrupadas.
export function buscarHistorico(consulta, limite = 10) {
  if (typeof consulta !== "string" || !consulta.trim()) {
    return [];
  }

  const palavras = normalizarTexto(consulta)
    .split(/\s+/)
    .filter((palavra) => palavra.length >= 3);

  if (palavras.length === 0) {
    return [];
  }

  const mensagens = obterHistoricoCompleto();
  const conversas = agruparConversas(mensagens);

  const resultados = conversas
    .map((conversa, indice) => {
      const textoCompleto = `
        ${conversa.pergunta}
        ${conversa.resposta}
      `;

      const textoNormalizado = normalizarTexto(textoCompleto);

      const correspondencias = palavras.filter((palavra) =>
        textoNormalizado.includes(palavra),
      ).length;

      return {
        ...conversa,
        indice,
        pontuacao: correspondencias,
      };
    })
    .filter((item) => item.pontuacao > 0)
    .sort((a, b) => b.pontuacao - a.pontuacao || b.indice - a.indice);

  const quantidade = Number.isInteger(limite)
    ? Math.max(0, Math.min(limite, 50))
    : 10;

  return resultados.slice(0, quantidade).map((item) => ({
    role: "conversation",
    pergunta: item.pergunta,
    resposta: item.resposta,
    texto: [
      item.pergunta ? `Saulo: ${item.pergunta}` : "",
      item.resposta ? `JARVIS: ${item.resposta}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    data: item.data,
    pontuacao: item.pontuacao,
  }));
}
