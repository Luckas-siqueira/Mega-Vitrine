# Importação de produtos por link

O painel dispara `importar-produto.yml`. O processo identifica o produto pelo link completo ou pelos redirecionamentos do link curto e consulta `productOfferV2` na API oficial de afiliados da Shopee.

## Ativação

1. Acesse https://affiliate.shopee.com.br/open_api e confira se sua conta pode solicitar acesso à Open API. A disponibilidade e aprovação dependem da Shopee.
2. Depois de obter o App ID e Secret, abra https://github.com/Luckas-siqueira/Mega-Vitrine/settings/secrets/actions e crie **Repository secrets** com os nomes exatos `SHOPEE_APP_ID` e `SHOPEE_SECRET`.
3. No token fine-grained usado no painel, limite o acesso a Mega-Vitrine e permita **Contents: Read and write** e **Actions: Read and write**. Não cole as chaves da Shopee no painel, código ou chat.
4. Cole o link da Shopee no painel e use **Extrair informações**. Confira os dados preenchidos e clique em **Cadastrar no GitHub**.

Se faltarem chaves ou aprovação, o painel informa que a importação não está ativada. O cadastro manual continua disponível.

## Dados e revisão

- Nome, preço e link de afiliado vêm da API. O link retornado corresponde à conta das credenciais configuradas; um link de outra pessoa não é mantido como link de compra.
- Categoria de informática é sugerida pelo nome e precisa ser conferida. A importação deve ser usada apenas para eletrônicos e itens do novo nicho. A descrição fica vazia porque o endpoint não oferece a descrição completa. Preço anterior não é inventado; destaque não é ativado automaticamente.
- Preço pode variar conforme tamanho/modelo. Nem todo produto aparece na API de afiliados.
- A foto é preservada em `imagens/originais`, com WebP até 480 px para o catálogo e até 1200 px para ampliar. Não aumenta imagens pequenas. Nomes incluem produto, IDs e hash para evitar substituir imagens existentes.
- Rascunhos ficam em `.imports/` (no repositório público) e só contêm dados do produto ou mensagens de erro, nunca credenciais. São consultados pela API do GitHub, não pelo GitHub Pages.
- Importar não adiciona produtos a `produtos.json`. As imagens e o rascunho são salvos primeiro; a publicação do cadastro é feita pelo usuário e inicia a atualização do site. Commits feitos com `GITHUB_TOKEN` não iniciam builds do Pages sozinhos.

## Referências oficiais

- API e assinatura: https://open-api.affiliate.shopee.com.br/explorer e https://open-api.affiliate.shopee.com.br/explorer/v2
- Disparo de workflows: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
- Eventos do GITHUB_TOKEN: https://docs.github.com/en/actions/concepts/security/github_token

## Verificações locais

`node tests/test_import_panel.cjs` verifica o preenchimento e os erros do painel. `python -m unittest discover -s tests` verifica resolução de links, validação de origem, assinatura com resposta simulada, preservação de imagens e ausência de alteração do catálogo. A integração completa com a Shopee exige credenciais aprovadas.

`node tests/test_site.cjs` verifica filtros, destaques e detalhes da vitrine de informática.
