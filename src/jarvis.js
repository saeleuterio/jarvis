import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

import {
  obterMemoria,
  adicionarFato,
  adicionarProjeto,
} from "./memory/memory.js";

// ======================================================
// CONFIGURAÇÃO DA API DO GEMINI
// ======================================================

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY não encontrada. Confira o arquivo .env.");
}

const ai = new GoogleGenAI({
  apiKey,
});

// ======================================================
// PERSONALIDADE DO JARVIS
// ======================================================

const INSTRUCOES_JARVIS = `
Você é JARVIS, um assistente pessoal digital.

Seu usuário é Saulo.

PERSONALIDADE:
- Inteligente, educado, objetivo e prestativo.
- Calmo, sofisticado e levemente bem-humorado.
- Converse sempre em português do Brasil.
- Quando apropriado, trate o usuário como "senhor Saulo".

MEMÓRIA:
- Você recebe informações da memória local do usuário.
- Utilize os fatos e projetos fornecidos para responder.
- Quando uma informação estiver registrada, responda com base nela.
- Nunca invente informações pessoais.
- Se não encontrar a resposta na memória, diga que não encontrou.
- Não afirme que salvou informações sem confirmação do sistema.

LIMITAÇÕES:
- Não afirme que controla o computador ou executa ações externas.
- Não diga que realizou ações que não foram realmente executadas.
`;

// ======================================================
// PROCESSAR COMANDOS DE MEMÓRIA
// ======================================================

function processarMemoria(mensagem) {
  const texto = mensagem
    .trim()
    .replace(/^jarvis[\s,!:.-]*/i, "")
    .trim();

  // Salvar projetos
  const comandoProjeto = texto.match(
    /^lembre que meu projeto(?: atual)?(?:\s+é|\s*:)??\s+(.+)$/i,
  );

  if (comandoProjeto && comandoProjeto[1]?.trim()) {
    const projeto = comandoProjeto[1].trim();

    adicionarProjeto(projeto);

    return {
      salvo: true,
      tipo: "projeto",
      texto: projeto,
    };
  }

  // Salvar fatos gerais
  const comandoFato = texto.match(/^lembre que\s+(.+)$/i);

  if (comandoFato && comandoFato[1]?.trim()) {
    const fato = comandoFato[1].trim();

    adicionarFato(fato);

    return {
      salvo: true,
      tipo: "fato",
      texto: fato,
    };
  }

  return {
    salvo: false,
  };
}

// ======================================================
// FORMATAR MEMÓRIA PARA CONSULTA
// ======================================================

function criarContextoMemoria(memoria) {
  return `
MEMÓRIA PESSOAL DO USUÁRIO

Nome:
${memoria.usuario?.nome ?? "Não informado"}

Fatos registrados:
${JSON.stringify(memoria.fatos ?? [], null, 2)}

Preferências registradas:
${JSON.stringify(memoria.preferencias ?? [], null, 2)}

Projetos registrados:
${JSON.stringify(memoria.projetos ?? [], null, 2)}

Tarefas registradas:
${JSON.stringify(memoria.tarefas ?? [], null, 2)}

Use essas informações para responder às perguntas pessoais.
Se a resposta não estiver registrada, informe isso claramente.
`;
}

// ======================================================
// FUNÇÃO PRINCIPAL DO JARVIS
// ======================================================

export async function perguntarAoJarvis(mensagem) {
  if (typeof mensagem !== "string" || !mensagem.trim()) {
    throw new Error("A mensagem não pode estar vazia.");
  }

  // 1. Processar um possível comando de memória.
  const resultadoMemoria = processarMemoria(mensagem);

  // 2. Carregar novamente a memória após a gravação.
  const memoria = obterMemoria();

  console.log("Memória carregada.");

  // 3. Preparar o contexto.
  const contextoMemoria = criarContextoMemoria(memoria);

  // 4. Se foi um comando de gravação, confirmar que a operação
  // realmente foi concluída antes de responder ao usuário.
  if (resultadoMemoria.salvo) {
    const memoriaConfirmada = obterMemoria();

    let encontrado = false;

    if (resultadoMemoria.tipo === "fato") {
      encontrado =
        memoriaConfirmada.fatos?.some(
          (item) => item.texto === resultadoMemoria.texto,
        ) ?? false;
    }

    if (resultadoMemoria.tipo === "projeto") {
      encontrado =
        memoriaConfirmada.projetos?.some(
          (item) => item.nome === resultadoMemoria.texto,
        ) ?? false;
    }

    if (!encontrado) {
      throw new Error(
        "A informação não foi encontrada após a tentativa de gravação.",
      );
    }

    return `Entendido, senhor Saulo. Registrei na minha memória: "${resultadoMemoria.texto}".`;
  }

  // 5. Consultar o Gemini quando a mensagem não for um comando
  // de gravação reconhecido.
  console.log("Enviando mensagem para o Gemini...");

  const resposta = await ai.models.generateContent({
    model: "gemini-2.5-flash",

    contents: `
${contextoMemoria}

MENSAGEM DO USUÁRIO:
${mensagem}
`,

    config: {
      systemInstruction: INSTRUCOES_JARVIS,
    },
  });

  console.log("Gemini respondeu.");

  return (
    resposta.text || "Desculpe, senhor Saulo. Não consegui gerar uma resposta."
  );
}
