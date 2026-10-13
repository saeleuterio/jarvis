import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const arquivoMemoria = path.join(__dirname, "memory.json");

const CATEGORIAS = [
  "perfil",
  "estudos",
  "veiculos",
  "viagens",
  "projetos",
  "preferencias",
  "tarefas",
  "geral",
];

function criarMemoriaInicial() {
  return {
    usuario: { nome: "Saulo" },
    categorias: Object.fromEntries(
      CATEGORIAS.map((categoria) => [categoria, []]),
    ),
  };
}

function normalizar(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classificarInformacao(texto) {
  const t = normalizar(texto);

  if (
    /\b(estud|curso|programacao|javascript|html|css|faculdade|aprend)\w*/.test(
      t,
    )
  ) {
    return "estudos";
  }

  if (/\b(carro|veiculo|moto|fox|yaris|automovel)\w*/.test(t)) {
    return "veiculos";
  }

  if (/\b(viagem|viajar|ushuaia|cruzeiro|ferias|destino)\w*/.test(t)) {
    return "viagens";
  }

  if (/\b(projeto|jarvis|aplicativo|sistema|site|desenvolvimento)\w*/.test(t)) {
    return "projetos";
  }

  if (/\b(prefiro|preferencia|gosto|nao gosto|quero respostas)\b/.test(t)) {
    return "preferencias";
  }

  if (/\b(tarefa|preciso fazer|tenho que|lembrete|prazo)\b/.test(t)) {
    return "tarefas";
  }

  if (/\b(meu nome|me chamo|moro em|minha profissao|meu trabalho)\b/.test(t)) {
    return "perfil";
  }

  return "geral";
}

function salvarArquivo(memoria) {
  const temporario = `${arquivoMemoria}.tmp`;

  fs.writeFileSync(temporario, JSON.stringify(memoria, null, 4), "utf8");

  fs.renameSync(temporario, arquivoMemoria);
}

function migrarMemoriaAntiga(dados) {
  const nova = criarMemoriaInicial();

  nova.usuario = dados.usuario ?? nova.usuario;

  if (dados.categorias) {
    for (const categoria of CATEGORIAS) {
      if (Array.isArray(dados.categorias[categoria])) {
        nova.categorias[categoria] = dados.categorias[categoria];
      }
    }
  }

  // Preserva fatos existentes na versão anterior.
  if (Array.isArray(dados.fatos)) {
    for (const fato of dados.fatos) {
      const texto = typeof fato === "string" ? fato : fato.texto;

      if (texto) {
        inserirSemDuplicar(
          nova,
          classificarInformacao(texto),
          texto,
          fato.data,
        );
      }
    }
  }

  // Preserva projetos existentes na versão anterior.
  if (Array.isArray(dados.projetos)) {
    for (const projeto of dados.projetos) {
      const texto = typeof projeto === "string" ? projeto : projeto.nome;

      if (texto) {
        inserirSemDuplicar(nova, "projetos", texto, projeto.data);
      }
    }
  }

  if (Array.isArray(dados.preferencias)) {
    for (const item of dados.preferencias) {
      const texto = typeof item === "string" ? item : item.texto;

      if (texto) {
        inserirSemDuplicar(nova, "preferencias", texto, item.data);
      }
    }
  }

  if (Array.isArray(dados.tarefas)) {
    for (const item of dados.tarefas) {
      const texto = typeof item === "string" ? item : item.texto;

      if (texto) {
        inserirSemDuplicar(nova, "tarefas", texto, item.data);
      }
    }
  }

  return nova;
}

function carregarMemoria() {
  if (!fs.existsSync(arquivoMemoria)) {
    const inicial = criarMemoriaInicial();
    salvarArquivo(inicial);
    return inicial;
  }

  const dados = JSON.parse(fs.readFileSync(arquivoMemoria, "utf8"));

  const memoria = migrarMemoriaAntiga(dados);

  // Atualiza o formato do arquivo quando necessário.
  if (!dados.categorias) {
    salvarArquivo(memoria);
  }

  return memoria;
}

function inserirSemDuplicar(memoria, categoria, texto, dataOriginal) {
  const lista = memoria.categorias[categoria];
  const chave = normalizar(texto);

  const existente = lista.find((item) => normalizar(item.texto) === chave);

  if (existente) {
    return {
      salvo: false,
      duplicado: true,
      registro: existente,
    };
  }

  const registro = {
    id: randomUUID(),
    texto: texto.trim(),
    criadoEm: dataOriginal ?? new Date().toISOString(),
  };

  lista.push(registro);

  return {
    salvo: true,
    duplicado: false,
    registro,
  };
}

export function obterMemoria() {
  const memoria = carregarMemoria();

  // Mantém compatibilidade com o jarvis.js da V1.1.
  const fatos = Object.entries(memoria.categorias)
    .filter(([categoria]) => categoria !== "projetos")
    .flatMap(([, registros]) =>
      registros.map((item) => ({
        texto: item.texto,
        data: item.criadoEm,
      })),
    );

  const projetos = memoria.categorias.projetos.map((item) => ({
    nome: item.texto,
    data: item.criadoEm,
  }));

  return {
    ...memoria,
    fatos,
    projetos,
    preferencias: memoria.categorias.preferencias,
    tarefas: memoria.categorias.tarefas,
  };
}

export function adicionarInformacao(texto, categoria) {
  if (typeof texto !== "string" || !texto.trim()) {
    throw new Error("A informação não pode estar vazia.");
  }

  const memoria = carregarMemoria();

  const categoriaFinal = CATEGORIAS.includes(categoria)
    ? categoria
    : classificarInformacao(texto);

  const resultado = inserirSemDuplicar(memoria, categoriaFinal, texto);

  if (resultado.salvo) {
    salvarArquivo(memoria);
    console.log(`Memória salva [${categoriaFinal}]: ${texto}`);
  } else {
    console.log(`Informação já registrada [${categoriaFinal}]: ${texto}`);
  }

  return {
    ...resultado,
    categoria: categoriaFinal,
  };
}

export function adicionarFato(texto) {
  return adicionarInformacao(texto, classificarInformacao(texto));
}

export function adicionarProjeto(texto) {
  return adicionarInformacao(texto, "projetos");
}

export function definirNome(nome) {
  if (typeof nome !== "string" || !nome.trim()) {
    throw new Error("O nome não pode estar vazio.");
  }

  const memoria = carregarMemoria();
  memoria.usuario.nome = nome.trim();
  salvarArquivo(memoria);
}

export function buscarMemoria(termo) {
  const memoria = carregarMemoria();
  const chave = normalizar(termo);

  if (!chave) {
    return [];
  }

  return Object.entries(memoria.categorias).flatMap(([categoria, registros]) =>
    registros
      .filter((item) => normalizar(item.texto).includes(chave))
      .map((item) => ({
        ...item,
        categoria,
      })),
  );
}

export function removerMemoria(termo) {
  const memoria = carregarMemoria();
  const chave = normalizar(termo);

  if (!chave) {
    throw new Error("Informe o texto da informação que deseja remover.");
  }

  const removidos = [];

  for (const categoria of CATEGORIAS) {
    const lista = memoria.categorias[categoria];

    const restantes = lista.filter((item) => {
      const corresponde = normalizar(item.texto).includes(chave);

      if (corresponde) {
        removidos.push({
          ...item,
          categoria,
        });
      }

      return !corresponde;
    });

    memoria.categorias[categoria] = restantes;
  }

  if (removidos.length > 0) {
    salvarArquivo(memoria);
  }

  return removidos;
}

export function listarCategorias() {
  return [...CATEGORIAS];
}
