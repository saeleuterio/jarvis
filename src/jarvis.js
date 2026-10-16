import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

import {
  obterMemoria,
  adicionarFato,
  adicionarProjeto,
  buscarMemoria,
  removerMemoria,
} from "./memory/memory.js";

import { obterHistorico, registrarInteracao } from "./memory/history.js";

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

function limparComando(mensagem) {
  return mensagem
    .trim()
    .replace(/^jarvis[\s,!:.-]*/i, "")
    .trim();
}

function processarComandoMemoria(mensagem) {
  const texto = limparComando(mensagem);

  // Salvar um projeto explicitamente.
  const projeto = texto.match(
    /^lembre que meu projeto(?: atual)?\s*(?:é|e|:)?\s+(.+)$/i,
  );

  if (projeto?.[1]?.trim()) {
    return {
      tipo: "salvar",
      resultado: adicionarProjeto(projeto[1].trim()),
    };
  }

  // Salvar fatos explicitamente.
  const fato = texto.match(/^lembre que\s+(.+)$/i);

  if (fato?.[1]?.trim()) {
    return {
      tipo: "salvar",
      resultado: adicionarFato(fato[1].trim()),
    };
  }

  // Esquecer uma informação específica.
  const esquecer = texto.match(
    /^(?:esqueça|esqueca|apague|remova|delete)\s+(?:a informação sobre|a informacao sobre|que|o registro sobre)?\s*(.+)$/i,
  );

  if (esquecer?.[1]?.trim()) {
    return {
      tipo: "remover",
      removidos: removerMemoria(esquecer[1].trim()),
    };
  }

  // Pesquisar explicitamente na memória.
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

// Registra interações comuns e comandos de memória.
function finalizarInteracao(pergunta, resposta) {
  registrarInteracao(pergunta, resposta);
  return resposta;
}

function responderComandoMemoria(comando, mensagem) {
  if (comando.tipo === "salvar") {
    const resultado = comando.resultado;

    if (resultado.duplicado) {
      return finalizarInteracao(
        mensagem,
        "Senhor Saulo, essa informação já estava registrada na minha memória. Não criei uma duplicata.",
      );
    }

    if (resultado.salvo) {
      return finalizarInteracao(
        mensagem,
        `Informação registrada na categoria "${resultado.categoria}", senhor Saulo.`,
      );
    }

    return finalizarInteracao(
      mensagem,
      "Não consegui confirmar a gravação da informação.",
    );
  }

  if (comando.tipo === "remover") {
    if (comando.removidos.length === 0) {
      return finalizarInteracao(
        mensagem,
        "Não encontrei informações correspondentes para remover.",
      );
    }

    return finalizarInteracao(
      mensagem,
      `Removi ${comando.removidos.length} registro(s) correspondente(s) da memória.`,
    );
  }

  if (comando.tipo === "consulta") {
    if (comando.resultados.length === 0) {
      return finalizarInteracao(
        mensagem,
        "Não encontrei essa informação na memória local.",
      );
    }

    const resposta =
      "Encontrei estas informações na memória:\n" +
      comando.resultados
        .map((item) => `- [${item.categoria}] ${item.texto}`)
        .join("\n");

    return finalizarInteracao(mensagem, resposta);
  }
}

export async function perguntarAoJarvis(mensagem) {
  if (typeof mensagem !== "string" || !mensagem.trim()) {
    throw new Error("A mensagem não pode estar vazia.");
  }

  // Os comandos existentes continuam funcionando.
  const comando = processarComandoMemoria(mensagem);

  if (comando) {
    return responderComandoMemoria(comando, mensagem);
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

    const resposta =
      registros.length === 0
        ? "Não encontrei essa informação na memória local."
        : registros.map((item) => item.texto).join("\n");

    return finalizarInteracao(mensagem, resposta);
  }

  console.log("Enviando mensagem para o Gemini...");

  // Recupera o histórico persistente.
  // Envia somente os campos aceitos pelo formato de conversa do Gemini.
  const historico = obterHistorico().map((item) => ({
    role: item.role,
    parts: item.parts,
  }));

  // Adiciona a pergunta atual sem registrá-la duas vezes.
  const mensagens = [
    ...historico,
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

  // Salva a pergunta e a resposta no arquivo JSON.
  finalizarInteracao(mensagem, textoResposta);

  console.log("Gemini respondeu.");

  return textoResposta;
}
