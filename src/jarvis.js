import { GoogleGenAI } from "@google/genai";

import {
  obterMemoria,
  adicionarFato,
  adicionarProjeto,
} from "./memory/memory.js";

// ======================================================
// CONFIGURAÇÃO DA API
// ======================================================

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("ERRO: GEMINI_API_KEY não foi encontrada no arquivo .env");
}

const ai = new GoogleGenAI({
  apiKey: apiKey,
});

// ======================================================
// PERSONALIDADE DO JARVIS
// ======================================================

const INSTRUCOES_JARVIS = `

Você é JARVIS, um assistente pessoal digital.

Seu usuário é Saulo.

Você deve conversar sempre em português do Brasil.

PERSONALIDADE:

- inteligente;
- educado;
- objetivo;
- prestativo;
- calmo;
- sofisticado;
- levemente bem-humorado.

Quando apropriado, trate o usuário como "senhor Saulo".

Você possui uma memória pessoal do usuário.

As informações da memória serão fornecidas
antes de cada conversa.

Utilize essas informações quando forem relevantes.

Nunca invente informações que não estejam na memória.

Se não souber alguma coisa, diga claramente
que não sabe.

Não diga que salvou uma informação se o sistema
não tiver realmente salvado.

Nesta versão você ainda não possui acesso direto ao:

- computador;
- arquivos pessoais;
- câmera;
- microfone;
- dispositivos externos.

Nunca diga que executou uma ação que você
não executou.

Responda sempre em português do Brasil.

`;

// ======================================================
// PROCESSAMENTO DA MEMÓRIA
// ======================================================

function processarMemoria(mensagem) {
  const texto = mensagem.trim();

  const textoMinusculo = texto.toLowerCase();

  // --------------------------------------------------
  // SALVAR PROJETO
  // --------------------------------------------------

  if (textoMinusculo.startsWith("lembre que meu projeto")) {
    const projeto = texto.replace(/lembre que meu projeto/i, "").trim();

    if (projeto) {
      adicionarProjeto(projeto);

      console.log("Memória salva - Projeto:", projeto);

      return {
        salvo: true,

        tipo: "projeto",

        texto: projeto,
      };
    }
  }

  // --------------------------------------------------
  // SALVAR FATO
  // --------------------------------------------------

  if (textoMinusculo.startsWith("lembre que")) {
    const fato = texto.substring(10).trim();

    if (fato) {
      adicionarFato(fato);

      console.log("Memória salva - Fato:", fato);

      return {
        salvo: true,

        tipo: "fato",

        texto: fato,
      };
    }
  }

  // --------------------------------------------------
  // NENHUMA MEMÓRIA IDENTIFICADA
  // --------------------------------------------------

  return {
    salvo: false,
  };
}

// ======================================================
// FUNÇÃO PRINCIPAL DO JARVIS
// ======================================================

export async function perguntarAoJarvis(mensagem) {
  // --------------------------------------------------
  // 1. VERIFICAR SE O USUÁRIO QUER SALVAR MEMÓRIA
  // --------------------------------------------------

  const memoriaProcessada = processarMemoria(mensagem);

  // --------------------------------------------------
  // 2. CARREGAR MEMÓRIA EXISTENTE
  // --------------------------------------------------

  const memoria = obterMemoria();

  console.log("Memória carregada.");

  // --------------------------------------------------
  // 3. PREPARAR MEMÓRIA PARA A IA
  // --------------------------------------------------

  const contextoMemoria = `

========== MEMÓRIA DO JARVIS ==========

USUÁRIO:

${JSON.stringify(memoria.usuario, null, 2)}


FATOS:

${JSON.stringify(memoria.fatos, null, 2)}


PREFERÊNCIAS:

${JSON.stringify(memoria.preferencias, null, 2)}


PROJETOS:

${JSON.stringify(memoria.projetos, null, 2)}


TAREFAS:

${JSON.stringify(memoria.tarefas, null, 2)}


========================================

`;

  // --------------------------------------------------
  // 4. INFORMAR AO GEMINI QUE UMA MEMÓRIA FOI SALVA
  // --------------------------------------------------

  let instrucoesExtras = "";

  if (memoriaProcessada.salvo) {
    instrucoesExtras = `

O usuário acabou de fornecer uma informação
que foi salva na memória.

Tipo:
${memoriaProcessada.tipo}

Informação:
${memoriaProcessada.texto}

Confirme de maneira natural que a informação
foi registrada.

`;
  }

  // --------------------------------------------------
  // 5. ENVIAR PARA O GEMINI
  // --------------------------------------------------

  console.log("Enviando mensagem para o Gemini...");

  const resposta = await ai.models.generateContent({
    model: "gemini-2.5-flash",

    contents:
      contextoMemoria +
      instrucoesExtras +
      `

Mensagem do usuário:

${mensagem}

`,

    config: {
      systemInstruction: INSTRUCOES_JARVIS,
    },
  });

  // --------------------------------------------------
  // 6. RETORNAR RESPOSTA
  // --------------------------------------------------

  console.log("Gemini respondeu.");

  return resposta.text;
}
