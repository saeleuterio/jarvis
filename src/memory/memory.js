import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function salvarMemoria(memoria) {
  fs.writeFileSync(arquivoMemoria, JSON.stringify(memoria, null, 4), "utf8");
}

function carregarMemoria() {
  if (!fs.existsSync(arquivoMemoria)) {
    const memoria = criarMemoriaInicial();
    salvarMemoria(memoria);
    return memoria;
  }

  const dados = fs.readFileSync(arquivoMemoria, "utf8");
  return JSON.parse(dados);
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

  console.log("Fato gravado no arquivo:", fato);
}

export function adicionarProjeto(projeto) {
  const memoria = carregarMemoria();

  memoria.projetos.push({
    nome: projeto,
    data: new Date().toISOString(),
  });

  salvarMemoria(memoria);

  console.log("Projeto gravado no arquivo:", projeto);
}

export function definirNome(nome) {
  const memoria = carregarMemoria();

  memoria.usuario.nome = nome;

  salvarMemoria(memoria);

  console.log("Nome atualizado na memória:", nome);
}
