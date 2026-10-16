import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

import {
  obterMemoria,
  adicionarFato,
  adicionarProjeto,
  buscarMemoria,
  removerMemoria,
} from "./memory/memory.js";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY não encontrada no arquivo .env.");
}

const ai = new GoogleGenAI({ apiKey });

const INSTRUCOES_JARVIS = `
Você é JARVIS, um assistente pessoal de Saulo.
Responda sempre em português do Brasil.
Seja educado, inteligente, objetivo e prestativo.
Use as informações da memória quando forem relevantes.
Considere as mensagens anteriores para compreender perguntas
de acompanhamento e manter a continuidade da conversa.
Nunca invente informações pessoais nem afirme ter executado
ações que o sistema não realizou.
`;

// Histórico temporário: mantém as últimas 10 interações.
const historicoConversa = [];
const MAX_MENSAGENS_HISTORICO = 20;

function limparComando(mensagem) {
  return mensagem
    .trim()
    .replace(/^jarvis[\s,!:.-]*/i, "")
    .trim();
}

function processarComandoMemoria(mensagem) {
  const texto = limparComando(mensagem);

  const projeto = texto.match(
    /^lembre que meu projeto(?: atual)?\s*(?:é|e|:)?\s+(.+)$/i,
  );

  if (projeto?.[1]?.trim()) {
    return {
      tipo: "salvar",
      resultado: adicionarProjeto(projeto[1].trim()),
    };
  }

  const fato = texto.match(/^lembre que\s+(.+)$/i);

  if (fato?.[1]?.trim()) {
    return {
      tipo: "salvar",
      resultado: adicionarFato(fato[1].trim()),
    };
  }

  const esquecer = texto.match(
    /^(?:esqueça|esqueca|apague|remova|delete)\s+(?:a informação sobre|a informacao sobre|que|o registro sobre)?\s*(.+)$/i,
  );

  if (esquecer?.[1]?.trim()) {
    return {
      tipo: "remover",
      removidos: removerMemoria(esquecer[1].trim()),
    };
  }

  const consultar = texto.match(
    /^(?:o que você lembra sobre|o que voce lembra sobre|consulte minha memória sobre|consulte minha memoria sobre)\s+(.+)$/i,
  );

  if (consultar?.[1]?.trim()) {
    return {
      tipo: "consulta",
      resultados: buscarMemoria(consultar[1].trim()),
    };
  }

  return null;
}

function montarContextoMemoria() {
  const memoria = obterMemoria();

  return `
MEMÓRIA PESSOAL:

${JSON.stringify(memoria, null, 2)}

Utilize a memória acima para responder quando for relevante.
Se não houver informação suficiente, diga isso claramente.
`;
}

function guardarNoHistorico(mensagemUsuario, respostaJarvis) {
  historicoConversa.push(
    {
      role: "user",
      parts: [{ text: mensagemUsuario }],
    },
    {
      role: "model",
      parts: [{ text: respostaJarvis }],
    },
  );

  // Limita o histórico às 20 mensagens mais recentes.
  while (historicoConversa.length > MAX_MENSAGENS_HISTORICO) {
    historicoConversa.shift();
  }
}

export async function perguntarAoJarvis(mensagem) {
  if (typeof mensagem !== "string" || !mensagem.trim()) {
    throw new Error("A mensagem não pode estar vazia.");
  }

  const comando = processarComandoMemoria(mensagem);

  if (comando?.tipo === "salvar") {
    const resultado = comando.resultado;

    if (resultado.duplicado) {
      return "Senhor Saulo, essa informação já estava registrada na minha memória. Não criei uma duplicata.";
    }

    if (resultado.salvo) {
      return `Informação registrada na categoria "${resultado.categoria}", senhor Saulo.`;
    }

    return "Não consegui confirmar a gravação da informação.";
  }

  if (comando?.tipo === "remover") {
    if (comando.removidos.length === 0) {
      return "Não encontrei informações correspondentes para remover.";
    }

    return `Removi ${comando.removidos.length} registro(s) correspondente(s) da memória.`;
  }

  if (comando?.tipo === "consulta") {
    if (comando.resultados.length === 0) {
      return "Não encontrei essa informação na memória local.";
    }

    return (
      "Encontrei estas informações na memória:\n" +
      comando.resultados
        .map((item) => `- [${item.categoria}] ${item.texto}`)
        .join("\n")
    );
  }

  // Consultas naturais simples: responder diretamente da memória.
  const texto = limparComando(mensagem).toLowerCase();
  const memoria = obterMemoria();

  if (
    /^(o que estou estudando|o que eu estou estudando|qual é meu projeto atual|qual e meu projeto atual)\??$/.test(
      texto,
    )
  ) {
    const estudo = /estudando/.test(texto);
    const registros = estudo
      ? buscarMemoria("estudando")
      : memoria.categorias.projetos;

    if (registros.length === 0) {
      return "Não encontrei essa informação na memória local.";
    }

    return registros.map((item) => item.texto).join("\n");
  }

  console.log("Enviando mensagem para o Gemini...");

  const mensagens = [
    ...historicoConversa,
    {
      role: "user",
      parts: [{ text: mensagem }],
    },
  ];

  const resposta = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: mensagens,
    config: {
      systemInstruction: `${INSTRUCOES_JARVIS}\n\n${montarContextoMemoria()}`,
    },
  });

  const textoResposta =
    resposta.text || "Desculpe, senhor Saulo. Não consegui gerar uma resposta.";

  guardarNoHistorico(mensagem, textoResposta);

  console.log("Gemini respondeu.");

  return textoResposta;
}
