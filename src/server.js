import "dotenv/config";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { perguntarAoJarvis } from "./jarvis.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const { mensagem } = req.body;

    if (!mensagem || !mensagem.trim()) {
      return res.status(400).json({
        erro: "Mensagem vazia.",
      });
    }

    console.log("Mensagem recebida:");
    console.log(mensagem);

    const resposta = await perguntarAoJarvis(mensagem);

    console.log("Resposta do JARVIS:");
    console.log(resposta);

    res.json({
      resposta: resposta,
    });
  } catch (erro) {
    console.error("");
    console.error("========== ERRO JARVIS ==========");
    console.error(erro);
    console.error("=================================");
    console.error("");

    res.status(500).json({
      erro: "Erro ao conversar com o JARVIS.",

      detalhes: erro.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log("        J.A.R.V.I.S.");
  console.log("=================================");
  console.log("Sistema iniciado.");
  console.log(`http://localhost:${PORT}`);
  console.log("=================================");
  console.log("");
});
