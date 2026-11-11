
import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const API_URL = (
  import.meta.env.VITE_API_URL || "/api"
).replace(/\/+$/, "");

// Lê as permissões do access token para controlar a interface.
// A autorização real continua sendo validada pelo backend.
function extrairPermissoes(token) {
  try {
    const parte = token.split(".")[1];
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))
    );

    return Array.isArray(payload.permissions)
      ? payload.permissions
      : [];
  } catch {
    return [];
  }
}

export default function App() {
  const {
    isLoading,
    isAuthenticated,
    error: authError,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [artigos, setArtigos] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [form, setForm] = useState({
    tituloArtigo: "",
    descricao: "",
    prioridade: 2,
  });

  const podeCriar = permissoes.includes("create:artigos");
  const podeExcluir = permissoes.includes("delete:artigos");

  // Busca todos os artigos autenticando a requisição.
  const carregarArtigos = useCallback(async () => {
    setCarregando(true);
    setErro("");

    try {
      const token = await getAccessTokenSilently();
      setPermissoes(extrairPermissoes(token));

      const resposta = await fetch(`${API_URL}/artigos`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        throw new Error(
          `Erro ao listar artigos: HTTP ${resposta.status}`
        );
      }

      const dados = await resposta.json();
      setArtigos(dados);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, [getAccessTokenSilently]);

  // Carrega os artigos após o login.
  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      carregarArtigos();
    } else {
      setArtigos([]);
      setPermissoes([]);
    }
  }, [isLoading, isAuthenticated, carregarArtigos]);

  // Cria um artigo.
  async function criarArtigo(event) {
    event.preventDefault();

    if (!podeCriar || salvando) return;

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const token = await getAccessTokenSilently();

      const resposta = await fetch(`${API_URL}/artigos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tituloArtigo: form.tituloArtigo.trim(),
          descricao: form.descricao.trim(),
          prioridade: Number(form.prioridade),
        }),
      });

      if (resposta.status === 403) {
        throw new Error("Você não tem permissão para criar artigos.");
      }

      if (!resposta.ok) {
        throw new Error(
          `Erro ao criar artigo: HTTP ${resposta.status}`
        );
      }

      setForm({
        tituloArtigo: "",
        descricao: "",
        prioridade: 2,
      });

      await carregarArtigos();
      setSucesso("Artigo criado com sucesso!");
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  // Exclui um artigo pelo ID.
  async function excluirArtigo(id) {
    if (!podeExcluir) return;

    const confirmou = window.confirm(
      "Tem certeza que deseja excluir este artigo?"
    );

    if (!confirmou) return;

    setExcluindoId(id);
    setErro("");
    setSucesso("");

    try {
      const token = await getAccessTokenSilently();

      const resposta = await fetch(`${API_URL}/artigos/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (resposta.status === 403) {
        throw new Error("Você não tem permissão para excluir artigos.");
      }

      if (!resposta.ok) {
        throw new Error(
          `Erro ao excluir artigo: HTTP ${resposta.status}`
        );
      }

      await carregarArtigos();
      setSucesso("Artigo excluído com sucesso!");
    } catch (error) {
      setErro(error.message);
    } finally {
      setExcluindoId(null);
    }
  }

  if (isLoading) {
    return <div className="loading">Carregando autenticação...</div>;
  }

  return (
    <div className="app">
      <style>{estilos}</style>

      <header className="header">
        <div>
          <h1>Base de Conhecimentos</h1>
          <p>Gerenciamento de artigos da empresa</p>
        </div>

        {isAuthenticated && (
          <div className="usuario">
            <span>{user?.name || user?.email}</span>
            <button
              className="botao secundario"
              onClick={() =>
                logout({
                  logoutParams: {
                    returnTo: window.location.origin,
                  },
                })
              }
            >
              Sair
            </button>
          </div>
        )}
      </header>

      <main className="container">
        {authError && (
          <div className="erro">
            Erro de autenticação: {authError.message}
          </div>
        )}

        {!isAuthenticated ? (
          <section className="card login">
            <h2>Bem-vindo!</h2>
            <p>
              Entre com sua conta para acessar a base de
              conhecimentos.
            </p>

            <button
              className="botao primario"
              onClick={() => loginWithRedirect()}
            >
              Entrar com Auth0
            </button>
          </section>
        ) : (
          <>
            <div className="topo">
              <div>
                <h2>Artigos</h2>
                <p>
                  Consulte os conteúdos cadastrados na empresa.
                </p>
              </div>

              <button
                className="botao secundario"
                onClick={carregarArtigos}
                disabled={carregando}
              >
                Atualizar
              </button>
            </div>

            {erro && <div className="erro">{erro}</div>}
            {sucesso && <div className="sucesso">{sucesso}</div>}

            {podeCriar && (
              <section className="card">
                <h3>Novo artigo</h3>

                <form onSubmit={criarArtigo}>
                  <label htmlFor="titulo">Título</label>
                  <input
                    id="titulo"
                    required
                    maxLength={255}
                    value={form.tituloArtigo}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tituloArtigo: e.target.value,
                      })
                    }
                    placeholder="Digite o título do artigo"
                  />

                  <label htmlFor="descricao">Descrição</label>
                  <textarea
                    id="descricao"
                    required
                    rows={4}
                    value={form.descricao}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        descricao: e.target.value,
                      })
                    }
                    placeholder="Digite a descrição do artigo"
                  />

                  <label htmlFor="prioridade">Prioridade</label>
                  <select
                    id="prioridade"
                    value={form.prioridade}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        prioridade: Number(e.target.value),
                      })
                    }
                  >
                    <option value={1}>1 - Baixa</option>
                    <option value={2}>2 - Média</option>
                    <option value={3}>3 - Alta</option>
                  </select>

                  <button
                    className="botao primario"
                    type="submit"
                    disabled={salvando}
                  >
                    {salvando ? "Salvando..." : "Criar artigo"}
                  </button>
                </form>
              </section>
            )}

            <section className="card">
              <div className="titulo-lista">
                <h3>Artigos cadastrados</h3>
                <span>{artigos.length} artigos</span>
              </div>

              {carregando ? (
                <p>Carregando artigos...</p>
              ) : artigos.length === 0 ? (
                <p>Nenhum artigo cadastrado.</p>
              ) : (
                <div className="lista">
                  {artigos.map((artigo) => (
                    <article className="artigo" key={artigo.id}>
                      <div className="artigo-topo">
                        <h3>{artigo.tituloArtigo}</h3>

                        <span className="prioridade">
                          Prioridade {artigo.prioridade}
                        </span>
                      </div>

                      <p className="descricao">
                        {artigo.descricao}
                      </p>

                      <p className="detalhes">
                        Criado por: {artigo.emailCriador}
                      </p>

                      {artigo.dataCriacao && (
                        <p className="detalhes">
                          Data:{" "}
                          {new Date(
                            artigo.dataCriacao
                          ).toLocaleString("pt-BR")}
                        </p>
                      )}

                      {podeExcluir && (
                        <button
                          className="botao perigo"
                          disabled={excluindoId === artigo.id}
                          onClick={() =>
                            excluirArtigo(artigo.id)
                          }
                        >
                          {excluindoId === artigo.id
                            ? "Excluindo..."
                            : "Excluir artigo"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const estilos = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #f4f6fb;
    color: #1e293b;
  }

  .header {
    background: #172554;
    color: white;
    padding: 24px 6%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .header h1 {
    margin: 0 0 8px;
    font-size: 26px;
  }

  .header p {
    margin: 0;
    color: #cbd5e1;
  }

  .usuario {
    display: flex;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
  }

  .container {
    max-width: 1050px;
    margin: 35px auto;
    padding: 0 20px;
  }

  .topo, .titulo-lista, .artigo-topo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .topo {
    margin-bottom: 20px;
  }

  .topo h2 {
    margin-bottom: 5px;
  }

  .topo p {
    color: #64748b;
  }

  .card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 26px;
    margin-bottom: 24px;
    box-shadow: 0 3px 10px #00000008;
  }

  .card h3 {
    margin-top: 0;
  }

  .login {
    text-align: center;
    padding: 60px 25px;
  }

  .login p {
    margin-bottom: 25px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  label {
    font-weight: 600;
  }

  input, textarea, select {
    width: 100%;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    font: inherit;
    background: white;
  }

  textarea {
    resize: vertical;
  }

  .botao {
    border: 0;
    padding: 11px 18px;
    border-radius: 7px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
  }

  .botao:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .primario {
    background: #2563eb;
    color: white;
  }

  .secundario {
    background: #e2e8f0;
    color: #1e293b;
  }

  .perigo {
    background: #fee2e2;
    color: #b91c1c;
    margin-top: 12px;
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .artigo {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
  }

  .artigo h3 {
    margin: 0;
  }

  .descricao {
    white-space: pre-wrap;
    line-height: 1.6;
  }

  .detalhes {
    font-size: 13px;
    color: #64748b;
    margin: 7px 0;
  }

  .prioridade {
    background: #dbeafe;
    color: #1d4ed8;
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 12px;
    white-space: nowrap;
  }

  .erro, .sucesso {
    padding: 14px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .erro {
    background: #fee2e2;
    color: #991b1b;
  }

  .sucesso {
    background: #dcfce7;
    color: #166534;
  }

  .loading {
    padding: 50px;
    text-align: center;
  }

  @media (max-width: 650px) {
    .header, .topo, .artigo-topo {
      flex-direction: column;
      align-items: flex-start;
    }

    .header h1 {
      font-size: 22px;
    }

    .card {
      padding: 18px;
    }
  }
`;
