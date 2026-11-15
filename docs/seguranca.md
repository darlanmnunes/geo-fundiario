# Segurança e acesso

O que protege a plataforma, onde cada proteção está e o que ainda falta antes de receber dados reais.

## O que este projeto NÃO tenta fazer

O código é aberto (AGPL-3.0). Ofuscar o JavaScript ou esconder a estrutura do banco não protege nada e
contraria a licença: quem quiser copiar a interface ou o modelo já pode, legalmente. O que precisa de
proteção são os **dados** (pessoais e do processo) e a **operação** (ninguém altera sem identificação,
ninguém derruba o serviço). É nisso que as camadas abaixo trabalham. Nenhum segredo vive no código do
navegador: chaves e senhas só existem em variáveis de ambiente do servidor.

## Camadas

| Camada | Proteção | Onde |
|---|---|---|
| Banco | Papéis de privilégio mínimo: `geof_api` (lê e grava, não apaga), `geof_leitura`, `geof_consulta` (só visões sem dados pessoais) | `db/migrations/009_seguranca.sql` |
| Banco | Segurança por linha nas tabelas com dados pessoais (LGPD) | idem |
| Banco | Auditoria só de inclusão: gatilho impede alterar ou apagar eventos; cada evento leva o e-mail de quem alterou | `009`, `012` |
| Banco | Cadastro versionado: nada é sobrescrito | `002`, `008` |
| API | Login com senha derivada por scrypt e sal por usuário; sessão de 12 h; perfis administrador, editor e leitor | `services/api/src/geo_fundiario/acesso.py` |
| API | Limite de requisições por IP (mais rígido em login, escrita, verificação pública e assistente) | `seguranca.py` |
| API | Cabeçalhos de segurança, lista de hosts aceitos, CORS restrito ao endereço do site | `seguranca.py`, `main.py` |
| API | Envio de arquivos: tipos permitidos, teto de tamanho contado no que chega, nome sem diretórios, download sempre como anexo | `documentos.py` |
| API | Documentação interativa desligada em produção | `main.py` |
| API | Consultas em linguagem natural: validação do SQL e execução com papel só de leitura, 5 s e 200 linhas | `assistente.py` |
| Interface | Política de conteúdo (CSP): só carrega scripts próprios e os servidores de mapa | `apps/web/src/app/layout.tsx` |
| Interface | Token de sessão em `sessionStorage` (não vai em cookie, some ao fechar a aba) | `apps/web/src/lib/sessao.ts` |

## Acesso

- O primeiro administrador é criado no servidor: `uv run python scripts/criar_admin.py "Nome" email@dominio`.
- Os demais usuários são criados pelo administrador, no navegador, em **Usuários**.
- Leitor consulta; editor insere e corrige dados e documentos; administrador também gerencia usuários.
- Bloquear um usuário ou trocar a senha encerra as sessões abertas dele.

## Colocar em produção

1. `GEOF_AMBIENTE=producao`; `GEOF_CORS_ORIGINS` com o endereço exato do site; `GEOF_HOSTS` com o domínio da API.
2. Usuário de conexão do banco membro **apenas** de `geof_api` (`grant geof_api to <usuario>`), nunca o dono das tabelas.
3. HTTPS no proxy na frente da API; `GEOF_ATRAS_DE_PROXY=true` só se o proxy for seu.
4. Interface: `NEXT_PUBLIC_API_URL` com o endereço da API (liga login e edição); `GEOF_API_URL` para ler os dados ao vivo.
5. Cópias de segurança do banco e do diretório de arquivos, testadas.

## Ainda falta (antes de dados reais)

- Recuperação de senha por e-mail e segundo fator para administradores.
- Permissão por município ou por núcleo (hoje o perfil vale para tudo).
- Limite de requisições compartilhado entre processos (hoje é em memória, por processo).
- Varredura de vírus nos arquivos enviados e armazenamento de objetos (S3/MinIO) com versão.
- Teste de invasão independente.

## Documentos: por que não um segundo banco

Os bytes dos arquivos ficam fora do PostgreSQL, endereçados pelo SHA-256; o banco guarda só metadados
(`jsonb` para o que varia, `tsvector` para busca) e os vínculos com pessoa, unidade e fase. Esse arranjo
serve a milhões de documentos: o volume fica no armazenamento de objetos, que é feito para isso, e as
consultas ("o que falta para esta família?") continuam sendo junções simples, dentro da mesma transação e
da mesma auditoria. Um banco de documentos à parte obrigaria a manter dois sistemas em sincronia sem
ganho para esse tipo de pergunta. Se um dia a busca em texto integral pesar, acrescenta-se um índice de
busca alimentado pelo banco, que continua sendo a fonte.
