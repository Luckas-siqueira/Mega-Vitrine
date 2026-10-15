# Segurança da MegaVitrine

## Proteções da vitrine pública

- Conexão HTTPS e HSTS fornecidos pelo GitHub Pages.
- CSP em todas as páginas HTML: JavaScript inline permitido somente com hash SHA-256 correspondente. Scripts externos, handlers HTML inline, objetos, frames internos e workers são bloqueados.
- CSS inline continua permitido para preservar os estilos existentes; essa exceção não permite JavaScript inline sem hash.
- Requisições JavaScript limitadas à própria origem. Imagens locais e HTTPS são permitidas.
- Referrer Policy `no-referrer` e links externos com `noopener noreferrer`.
- Links de produtos aceitam apenas domínios exatos da Shopee e do Mercado Livre listados em `allowedStoreHosts`, com HTTPS, sem credenciais e sem portas alternativas. Os parâmetros de afiliado são preservados.
- Conteúdo dos produtos inserido com `textContent`, sem interpretar HTML.

Os links curtos das lojas podem redirecionar; a lista de domínios não comprova a identidade de vendedores nem garante a segurança do destino final.

## Ao editar scripts

Execute depois de qualquer alteração de JavaScript nas páginas:

```sh
python tools/update_security_policy.py
node tests/test_security.cjs
node tests/test_catalog_freshness.cjs
```

O teste de segurança falha se os hashes não corresponderem aos scripts publicados. Alterações em `produtos.json` não exigem novos hashes. Ao adicionar uma loja, revise os domínios e atualize a lista e os testes.

## Limites da hospedagem e desta revisão

A CSP é entregue por meta HTML. Isso não configura cabeçalhos HTTP. Bloquear a incorporação desta vitrine por outros sites exige `Content-Security-Policy: frame-ancestors 'none'` ou `X-Frame-Options` na resposta HTTP; `frame-ancestors` não funciona por meta. O GitHub Pages atual não tem essa configuração disponível no repositório. `frame-src 'none'` bloqueia frames dentro da vitrine, não a incorporação da própria vitrine.

Os cabeçalhos `X-Content-Type-Options` e `Permissions-Policy` também dependem da hospedagem. Para controlá-los, será necessário um provedor ou proxy que suporte cabeçalhos personalizados. Não foi criada uma configuração fictícia de cabeçalhos.

Esta revisão não certifica o painel Oferta Tech AI, a autenticação, o Supabase, segredos de serviços externos ou permissões privadas da conta GitHub. Não é um pentest. Restrinja colaboradores e tokens ao necessário e mantenha autenticação de dois fatores na conta GitHub. Nunca salve credenciais privadas neste repositório público; use segredos nos serviços apropriados.
