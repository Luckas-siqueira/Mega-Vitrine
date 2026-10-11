const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync('painel.html','utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function setup(fetch){
 const elements=new Map(),stored=[];
 function element(){return {value:'',textContent:'',className:'',hidden:false,checked:false,disabled:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn},scrollIntoView(){},focus(){},replaceChildren(){},append(){},remove(){}}}
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 for(const match of html.matchAll(/id="([^"]+)"/g))$(match[1]);
 const ctx={fetch,URL,crypto:webcrypto,Uint8Array,TextEncoder,TextDecoder,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,ms===4000?0:ms),clearTimeout,Date,JSON,Math,Array,String,Error,TypeError,confirm:()=>true,document:{getElementById:$,createElement:element,querySelectorAll:()=>[...elements.values()]},localStorage:{getItem:()=>null,setItem:(...args)=>stored.push(args)},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {$,ctx,stored,run:s=>vm.runInContext(s,ctx)};
}
function response(status,data={},headers={}){return {status,ok:status>=200&&status<300,headers:{get:name=>headers[name]||null},json:async()=>data};}
const catalog={sha:'old-sha',content:Buffer.from('[]').toString('base64')};
function manualFields($){$('githubToken').value='github_pat_example';$('name').value='Novo produto';$('category').value='Tecnologia';$('url').value='https://s.shopee.com.br/example';}
(async()=>{
 const normalized=setup(async()=>response(200));normalized.$('githubToken').value=' "Bearer github_pat_abc\u200B123\n" ';assert.equal(normalized.run('token()'),'github_pat_abc123');normalized.$('githubToken').value='https://s.shopee.com.br/link';assert.throws(()=>normalized.run('token()'),/recebeu um link/);
 let calls=0;const manual=setup(async()=>{calls++;return response(200)});manual.$('importUrl').value='https://s.shopee.com.br/manual';await manual.$('useProductLink').handlers.click();assert.equal(manual.$('url').value,'https://s.shopee.com.br/manual');assert.equal(calls,0);assert.match(manual.$('importStatus').textContent,/não precisa da API/);
 const diag=setup(async url=>url.endsWith('/user')?response(200,{login:'Luckas-siqueira'}):url.includes('/contents/')?response(200,catalog):response(403,{message:'Resource not accessible by personal access token'}));diag.$('githubToken').value='github_pat_example';await diag.$('testGithub').handlers.click();assert.match(diag.$('githubStatus').textContent,/Token reconhecido/);assert.match(diag.$('githubStatus').textContent,/teste não altera/);assert.match(diag.$('connectionImport').textContent,/Actions/);assert.doesNotMatch(diag.$('connectionImport').textContent,/expirado/);
 for(const [status,headers,pattern]of [[401,{},/recusou este token/],[403,{},/Contents: Read and write/],[403,{'x-ratelimit-remaining':'0'},/limitou as consultas/],[422,{},/não confirma um token inválido/]]){
  const t=setup(async()=>response(status,{},headers));t.$('githubToken').value='github_pat_example';await assert.rejects(t.run("githubRequest('PUT',{})"),pattern);assert.equal(t.stored.length,0);
 }
 const network=setup(async()=>{throw new TypeError('Failed to fetch')});network.$('githubToken').value='github_pat_example';await assert.rejects(network.run("githubRequest('GET')"),/conectar ao GitHub/);
 const writeRequests=[];const save=setup(async(url,opts)=>{writeRequests.push({url,opts});return opts.method==='PUT'?response(200,{content:{sha:'new-sha'}}):response(200,catalog)});manualFields(save.$);await save.$('productForm').handlers.submit({preventDefault(){}});assert.equal(writeRequests.length,2);assert.ok(writeRequests.every(r=>r.url.includes('/contents/produtos.json')));assert.match(save.$('githubStatus').textContent,/Cadastro confirmado/);assert.equal(JSON.parse(JSON.parse(writeRequests[1].opts.body).content?Buffer.from(JSON.parse(writeRequests[1].opts.body).content,'base64').toString():null)[0].nome,'Novo produto');assert.ok(save.stored.every(args=>!JSON.stringify(args).includes('github_pat_example')));
 const denied=setup(async(url,opts)=>opts.method==='PUT'?response(403):response(200,catalog));manualFields(denied.$);await denied.$('productForm').handlers.submit({preventDefault(){}});assert.equal(denied.$('name').value,'Novo produto');assert.match(denied.$('githubStatus').textContent,/Contents/);
 const importFailure=setup(async()=>response(403));importFailure.$('githubToken').value='github_pat_example';importFailure.$('importUrl').value='https://s.shopee.com.br/example';await importFailure.$('importProduct').handlers.click();assert.match(importFailure.$('importStatus').textContent,/Actions/);assert.equal(importFailure.run('saving'),false);
 let importCalls=0;const extracted={ok:true,product:{nome:'Creatina',categoria:'Fitness',descricao:'',imagem:'imagens/produtos/creatina.webp',url:'https://s.shopee.com.br/own',preco:29.9},imageBytes:1000,largeImageBytes:3000,warnings:['Conferir categoria']};
 const success=setup(async()=>++importCalls===1?response(204):response(200,{content:Buffer.from(JSON.stringify(extracted)).toString('base64')}));success.$('githubToken').value='github_pat_example';success.$('importUrl').value='https://s.shopee.com.br/example';await success.$('importProduct').handlers.click();assert.equal(success.$('name').value,'Creatina');assert.equal(success.$('price').value,'29,9');assert.equal(success.run('saving'),false);
 let inactiveCalls=0;const inactive=setup(async()=>++inactiveCalls===1?response(204):response(200,{content:Buffer.from(JSON.stringify({ok:false,error:'Importação ainda não ativada. Configure SHOPEE_APP_ID e SHOPEE_SECRET.'})).toString('base64')}));inactive.$('githubToken').value='github_pat_example';inactive.$('importUrl').value='https://s.shopee.com.br/example';await inactive.$('importProduct').handlers.click();assert.match(inactive.$('importStatus').textContent,/SHOPEE_APP_ID/);assert.doesNotMatch(inactive.$('importStatus').textContent,/token.*inválido/);
 console.log('Conexão e painel verificados: limpeza do token, diagnóstico, permissões, limites, rede, cadastro manual, preservação dos campos e ausência de token no armazenamento.');
})().catch(error=>{console.error(error);process.exitCode=1});
