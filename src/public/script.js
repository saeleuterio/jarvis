const input = document.getElementById("mensagem");

const enviar = document.getElementById("enviar");

const chat = document.getElementById("chat");

function adicionarMensagem(texto, classe) {
  const div = document.createElement("div");

  div.classList.add("message", classe);

  div.textContent = texto;

  chat.appendChild(div);

  chat.scrollTop = chat.scrollHeight;
}

async function enviarMensagem() {
  const mensagem = input.value.trim();

  if (!mensagem) {
    return;
  }

  adicionarMensagem("Você: " + mensagem, "user");

  input.value = "";

  enviar.disabled = true;

  try {
    const resposta = await fetch("/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        mensagem,
      }),
    });

    const dados = await resposta.json();

    if (dados.resposta) {
      adicionarMensagem("JARVIS: " + dados.resposta, "jarvis");
    } else {
      adicionarMensagem("JARVIS: Não consegui responder.", "jarvis");
    }
  } catch (erro) {
    console.error(erro);

    adicionarMensagem("JARVIS: Erro de comunicação.", "jarvis");
  }

  enviar.disabled = false;

  input.focus();
}

enviar.addEventListener("click", enviarMensagem);

input.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    enviarMensagem();
  }
});
