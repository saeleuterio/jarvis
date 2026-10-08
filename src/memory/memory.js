import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const arquivoMemoria = path.join(__dirname, "memory.json");

function criarMemoriaInicial() {
  return {
    usuario: {
      nome: "Saulo",
    },

    fatos: [],

    preferencias: [],

    projetos: [],

    tarefas: [],
  };
}

function carregarMemoria() {
  try {
    if (!fs.existsSync(arquivoMemoria)) {
      const memoria = criarMemoriaInicial();

      salvarMemoria(memoria);

      return memoria;
    }

    const dados = fs.readFileSync(arquivoMemoria, "utf-8");

    return JSON.parse(dados);
  } catch (erro) {
    console.error("Erro ao carregar memória:", erro);

    return criarMemoriaInicial();
  }
}

function salvarMemoria(memoria) {
  fs.writeFileSync(
    arquivoMemoria,

    JSON.stringify(memoria, null, 4),

    "utf-8",
  );
}

export function obterMemoria() {
  return carregarMemoria();
}

export function adicionarFato(fato) {
  const memoria = carregarMemoria();

  memoria.fatos.push({
    texto: fato,

    data: new Date().toISOString(),
  });

  salvarMemoria(memoria);
}

export function adicionarProjeto(projeto) {
  const memoria = carregarMemoria();

  memoria.projetos.push({
    nome: projeto,

    data: new Date().toISOString(),
  });

  salvarMemoria(memoria);
}

export function definirNome(nome) {
  const memoria = carregarMemoria();

  memoria.usuario.nome = nome;

  salvarMemoria(memoria);
}
