const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const code=fs.readFileSync('painel.html','utf8').split('// A consulta é executada no GitHub; as chaves da Shopee não passam pelo navegador.')[1].split('</script>')[0];
function setup(fetch){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',className:'',hidden:true,checked:false,addEventListener(type,fn){this.handler=fn},scrollIntoView(){}});return elements.get(id)};
 const ctx={$: $,fetch,URL,crypto:webcrypto,Uint8Array,setTimeout:fn=>{fn();return 1},Date,JSON,Math,Array,String,Error,confirm:()=>true,saving:false,editing:-1,categories:['Outros','Fitness'],token:()=> 'test-token',validImage:s=>s.startsWith('imagens/produtos/'),decode64Unicode:s=>Buffer.from(s,'base64').toString('utf8'),feedback:s=>{$('feedback').textContent=s},resetForm:()=>{for(const id of ['name','image','description','url','price','oldPrice'])$(id).value=''},lockSaving:v=>{ctx.saving=v}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {$,ctx};
}
(async()=>{
 let calls=0;
 const p={nome:'Creatina',categoria:'Fitness',descricao:'',imagem:'imagens/produtos/creatina.webp',url:'https://s.shopee.com.br/own',preco:29.9};
 const result={ok:true,product:p,imageBytes:1000,largeImageBytes:3000,warnings:['Revisar categoria']};
 const {$,ctx}=setup(async(url,opts)=>{calls++;assert.equal(opts.headers.Authorization,'Bearer test-token');if(calls===1){assert.equal(opts.method,'POST');const data=JSON.parse(opts.body);assert.equal(data.inputs.product_url,'https://s.shopee.com.br/test');assert.match(data.inputs.request_id,/^[a-f0-9]{32}$/);return {ok:true,status:204};}return {ok:true,status:200,json:async()=>({content:Buffer.from(JSON.stringify(result)).toString('base64')})};});
 $('importUrl').value='https://s.shopee.com.br/test';await $('importProduct').handler();
 assert.equal(calls,2);assert.equal($('name').value,'Creatina');assert.equal($('price').value,'29,9');assert.equal($('featured').checked,false);assert.equal($('importReview').hidden,false);assert.equal(ctx.saving,false);
 $('importUrl').value='https://s.shopee.com.br.evil.test/a';await $('importProduct').handler();assert.equal(calls,2);
 const failure=setup(async()=>({ok:false,status:403}));failure.$('importUrl').value='https://s.shopee.com.br/test';failure.$('name').value='Não perder';await failure.$('importProduct').handler();assert.equal(failure.$('name').value,'Não perder');assert.match(failure.$('importStatus').textContent,/Actions/);assert.equal(failure.ctx.saving,false);
 const inactive=setup(async(url,opts)=>opts.method==='POST'?{ok:true,status:204}:{ok:true,status:200,json:async()=>({content:Buffer.from(JSON.stringify({ok:false,error:'Configure SHOPEE_APP_ID'})).toString('base64')})});inactive.$('importUrl').value='https://s.shopee.com.br/test';await inactive.$('importProduct').handler();assert.match(inactive.$('importStatus').textContent,/SHOPEE_APP_ID/);assert.equal(inactive.$('name').value,'');
 console.log('Importação no painel: preenchimento, link inválido, permissões e API inativa verificados.');
})().catch(e=>{console.error(e);process.exitCode=1});
