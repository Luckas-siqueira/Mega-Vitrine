const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const pages=fs.readdirSync('.').filter(p=>p.endsWith('.html'));
for(const page of pages){
 const html=fs.readFileSync(page,'utf8');
 const meta=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
 assert.ok(meta,`${page}: CSP ausente`);
 const directives=Object.fromEntries(meta[1].split(';').map(d=>{const [name,...values]=d.trim().split(/\s+/);return [name,values]}));
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
 for(const [,attrs,source] of scripts){
  assert.ok(!/\bsrc\s*=/i.test(attrs),'Scripts externos devem passar por revisão');
  const hash="'sha256-"+crypto.createHash('sha256').update(source).digest('base64')+"'";
  assert.ok(directives['script-src'].includes(hash),`${page}: hash de script desatualizado`);
  new vm.Script(source);
 }
 assert.equal(directives['script-src'].length,scripts.length||1);
 for(const directive of ['object-src','base-uri','frame-src','worker-src','script-src-attr'])assert.deepEqual(directives[directive],["'none'"]);
 assert.deepEqual(directives['connect-src'],["'self'"]);
 assert.ok(directives['script-src'].every(v=>v==="'none'"||/^'sha256-[A-Za-z0-9+/]+=*'$/.test(v)));
 assert.ok(html.indexOf(meta[0])<html.search(/<style|<script/i));
 assert.match(html,/<meta name="referrer" content="no-referrer">/);
}
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('const allowedStoreHosts=');const end=html.indexOf('const text=',start);
assert.ok(start>0&&end>start);
const ctx=vm.createContext({URL});vm.runInContext(html.slice(start,end),ctx);
const check=value=>vm.runInContext(`validAffiliateUrl(${JSON.stringify(value)})`,ctx);
for(const url of ['https://s.shopee.com.br/abc?affiliate=123','https://meli.la/32d4BRi','https://produto.mercadolivre.com.br/MLB-123','https://www.shopee.com.br:443/test'])assert.equal(check(url),true,url);
for(const url of ['javascript:alert(1)','data:text/html,hello','http://meli.la/abc','https://evil.example/','https://meli.la.evil.example/x','https://evilmeli.la/x','https://meli.la@evil.example/x','https://user:password@meli.la/x','https://meli.la:8443/x','https://127.0.0.1/x','//meli.la/x','https://meli.la\\@evil.example/x','https://meli.la/\nx',null,{},'https://meli.la/'+ 'a'.repeat(4096)])assert.equal(check(url),false,JSON.stringify(url));
for(const product of JSON.parse(fs.readFileSync('produtos.json','utf8')))assert.equal(check(product.url),true,product.nome);
assert.match(html,/if\(validAffiliateUrl\(p\.url\)\)/);
assert.ok(!html.includes('innerHTML'));
console.log(`Segurança verificada: CSP e hashes em ${pages.length} páginas; links legítimos aceitos, URLs maliciosas bloqueadas e catálogo compatível.`);
