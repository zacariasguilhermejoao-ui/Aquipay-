const enc=new TextEncoder();
const OAUTH_SCOPES=["profile:read","listings:read","proposals:read","credits:read","conversations:read"];
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const b64=bytes=>{let s="";for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).split("+").join("-").split("/").join("_").replace(/=+$/g,"")};
const b64d=s=>Uint8Array.from(atob(String(s||"").replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(String(s||"").length/4)*4,"=")),c=>c.charCodeAt(0));
const hash=async value=>b64(await crypto.subtle.digest("SHA-256",enc.encode(value)));
const rand=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const htmlEscape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formPage=(title,body)=>new Response(`<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${htmlEscape(title)} · AquiPay</title><style>*{box-sizing:border-box}body{margin:0;background:#08090d;color:#f5f5f7;font:16px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px}.card{width:min(100%,460px);background:#12141c;border:1px solid #292d3a;border-radius:20px;padding:26px}h1{font-size:24px;margin:0 0 8px}p{color:#aeb3c2;line-height:1.5}label{display:block;font-size:14px;margin:14px 0 6px}input{width:100%;padding:13px;border-radius:10px;border:1px solid #3a4050;background:#090b11;color:white;font:inherit}button{width:100%;padding:14px;border:0;border-radius:11px;background:#8c6cff;color:white;font-weight:700;font-size:15px;margin-top:14px}button.secondary{background:#252938;color:white}.scope{display:flex;align-items:center;gap:10px;margin:12px 0;color:#d6d9e2}.scope input{width:auto}.muted{font-size:13px;color:#969cac}.error{color:#ff9696}</style><main class="card"><h1>${htmlEscape(title)}</h1>${body}</main></html>`,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer"}});
const urlOk=value=>{try{const u=new URL(value),loopback=["localhost","127.0.0.1","[::1]"].includes(u.hostname);return !u.username&&!u.password&&!u.hash&&(u.protocol==="https:"||(loopback&&u.protocol==="http:"))}catch{return false}};
const scopesParse=value=>[...new Set(String(value||"").split(/\s+/).filter(Boolean))];
const scopeLabel=s=>({"profile:read":"Ler o teu perfil profissional","listings:read":"Pesquisar e consultar anúncios","proposals:read":"Consultar as tuas propostas","credits:read":"Consultar o saldo de créditos","conversations:read":"Consultar as tuas conversas"}[s]||s);
async function passHash(password,salt){const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);return b64(await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:100000,hash:"SHA-256"},key,256))}
function base32Decode(value){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=0,v=0,out=[];for(const ch of String(value||"").toUpperCase().replace(/=+$/,"")){const n=alphabet.indexOf(ch);if(n<0)continue;v=(v<<5)|n;bits+=5;if(bits>=8){out.push((v>>>(bits-8))&255);bits-=8}}return new Uint8Array(out)}
async function verifyTotp(secret,code){if(!/^\d{6}$/.test(String(code||"")))return false;const key=await crypto.subtle.importKey("raw",base32Decode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);const now=Math.floor(Date.now()/30000);for(let d=-1;d<=1;d++){const counter=new Uint8Array(8);new DataView(counter.buffer).setBigUint64(0,BigInt(now+d),false);const mac=new Uint8Array(await crypto.subtle.sign("HMAC",key,counter)),offset=mac[mac.length-1]&15,n=((mac[offset]&127)<<24)|((mac[offset+1]&255)<<16)|((mac[offset+2]&255)<<8)|(mac[offset+3]&255);if(String(n%1000000).padStart(6,"0")===String(code))return true}return false}
async function decryptTotp(value,env){const raw=b64d(env.TOTP_ENCRYPTION_KEY||"");if(raw.length!==32)throw Error("2FA indisponível");const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]),packed=b64d(value),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:packed.slice(0,12)},key,packed.slice(12));return new TextDecoder().decode(plain)}
function redirectWith(uri,params){const u=new URL(uri);for(const[k,v]of Object.entries(params))if(v!==undefined&&v!==null)u.searchParams.set(k,String(v));return Response.redirect(u.toString(),302)}
async function getClient(env,id){return env.DB.prepare("SELECT client_id,client_name,redirect_uris FROM oauth_clients WHERE client_id=?").bind(id).first()}
async function googleClaims(credential,clientId){
 const parts=String(credential||"").split(".");if(parts.length!==3)throw Error("jwt");
 const header=JSON.parse(new TextDecoder().decode(b64d(parts[0]))),claims=JSON.parse(new TextDecoder().decode(b64d(parts[1])));
 if(header.alg!=="RS256"||!header.kid)throw Error("alg");
 const response=await fetch("https://www.googleapis.com/oauth2/v3/certs",{cf:{cacheTtl:3600,cacheEverything:true}});
 const jwks=await response.json(),jwk=(jwks.keys||[]).find(k=>k.kid===header.kid);if(!jwk)throw Error("kid");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64d(parts[2]),enc.encode(parts[0]+"."+parts[1])))throw Error("sig");
 if(!["accounts.google.com","https://accounts.google.com"].includes(claims.iss)||!String(clientId||"").split(",").map(x=>x.trim()).filter(Boolean).includes(claims.aud)||!(claims.exp>Date.now()/1000)||!claims.sub)throw Error("claims");
 return claims;
}
async function authorizeGet(req,env){
 const u=new URL(req.url),clientId=u.searchParams.get("client_id")||"",redirectUri=u.searchParams.get("redirect_uri")||"",challenge=u.searchParams.get("code_challenge")||"",method=u.searchParams.get("code_challenge_method")||"",state=u.searchParams.get("state")||"",responseType=u.searchParams.get("response_type")||"",resource=u.searchParams.get("resource")||"https://aquipay-api.osamariches.workers.dev/mcp";
 const client=await getClient(env,clientId);let redirects=[];try{redirects=JSON.parse(client?.redirect_uris||"[]")}catch{}
 if(!client||!redirects.includes(redirectUri)||responseType!=="code"||method!=="S256"||!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)||!state||state.length>512||resource!=="https://aquipay-api.osamariches.workers.dev/mcp")return formPage("Pedido inválido","<p class='error'>O pedido de autorização é inválido ou expirou. Volta à aplicação de IA e tenta novamente.</p>");
 const requested=scopesParse(u.searchParams.get("scope")||OAUTH_SCOPES.join(" "));if(!requested.length||requested.some(s=>!OAUTH_SCOPES.includes(s)))return formPage("Permissões inválidas","<p class='error'>A aplicação pediu permissões não suportadas.</p>");
 const hidden=(k,v)=>`<input type="hidden" name="${k}" value="${htmlEscape(v)}">`;
 const fields=hidden("client_id",clientId)+hidden("redirect_uri",redirectUri)+hidden("code_challenge",challenge)+hidden("code_challenge_method","S256")+hidden("state",state)+hidden("scope",requested.join(" "))+hidden("resource",resource);
 const scopes=requested.map(s=>`<label class="scope"><input type="checkbox" name="approved_scope" value="${s}" checked> ${scopeLabel(s)}</label>`).join("");
 const body=`<p><b>${htmlEscape(client.client_name)}</b> quer ligar-se à tua conta AquiPay. Escolhe o que autorizas. Não partilhes a tua palavra-passe com a IA.</p><form id="oauthConsent" method="post" action="/oauth/authorize">${fields}<input type="hidden" name="credential" id="googleCredential"><input type="hidden" name="decision" id="oauthDecision" value="approve"><label>Email da conta</label><input name="email" type="email" autocomplete="username"><label>Palavra-passe</label><input name="password" type="password" autocomplete="current-password"><label>Código de autenticação (se tiveres 2FA)</label><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="20"><div style="margin-top:18px"><b>Permissões pedidas</b>${scopes}</div><button type="submit" onclick="document.getElementById('oauthDecision').value='approve'">Autorizar AquiPay</button><button type="submit" class="secondary" onclick="document.getElementById('oauthDecision').value='deny'">Recusar</button></form>${env.GOOGLE_CLIENT_ID?`<script src="https://accounts.google.com/gsi/client" async defer></script><div id="g_id_onload" data-client_id="${htmlEscape(env.GOOGLE_CLIENT_ID.split(",")[0])}" data-callback="aquipayGoogleCredential" data-auto_prompt="false"></div><div class="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="filled_black" data-text="continue_with" data-size="large" style="margin-top:14px"></div><script>window.aquipayGoogleCredential=function(r){document.getElementById("googleCredential").value=r.credential;document.getElementById("oauthConsent").submit()}</script>`:""}<p class="muted">Podes revogar esta ligação a qualquer momento nas Definições do AquiPay.</p>`;
 return formPage("Ligar ao AquiPay",body);
}
async function authorizePost(req,env){
 const form=await req.formData(),v=k=>String(form.get(k)||"");
 const clientId=v("client_id"),redirectUri=v("redirect_uri"),challenge=v("code_challenge"),state=v("state"),decision=v("decision"),resource=v("resource");
 const client=await getClient(env,clientId);let redirects=[];try{redirects=JSON.parse(client?.redirect_uris||"[]")}catch{}
 if(!client||!redirects.includes(redirectUri)||!state||state.length>512||resource!=="https://aquipay-api.osamariches.workers.dev/mcp"||!/^[A-Za-z0-9_-]{43,128}$/.test(challenge))return formPage("Pedido inválido","<p class='error'>O pedido de autorização não é válido. Fecha esta página e tenta ligar novamente.</p>");
 if(decision!=="approve")return redirectWith(redirectUri,{error:"access_denied",error_description:"O utilizador recusou o acesso.",state});
 const requested=scopesParse(v("scope")),approved=scopesParse(form.getAll("approved_scope").join(" "));
 if(!requested.length||requested.some(s=>!OAUTH_SCOPES.includes(s))||approved.some(s=>!requested.includes(s))||!approved.length)return formPage("Permissões inválidas","<p class='error'>Seleciona pelo menos uma permissão válida.</p>");
 const email=v("email").trim().toLowerCase(),password=v("password"),code=v("code").trim(),credential=v("credential");
 const rlKey="oauth_login:"+(req.headers.get("cf-connecting-ip")||"unknown")+":"+Math.floor(Date.now()/900000);
 const rl=await env.DB.prepare("INSERT INTO rate_limits(k,n,exp) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n").bind(rlKey,Date.now()+1800000).first();
 if(rl?.n>10)return formPage("Tenta mais tarde","<p class='error'>Demasiadas tentativas. Aguarda e tenta novamente.</p>");
 let user=null;
 if(credential){
   let claims;try{claims=await googleClaims(credential,env.GOOGLE_CLIENT_ID)}catch{return formPage("Google não validado","<p class='error'>Não foi possível validar a tua conta Google. Tenta novamente.</p>")}
   const googleEmail=String(claims.email||"").toLowerCase();
   if((claims.email_verified!==true&&claims.email_verified!=="true")||!googleEmail.includes("@"))return formPage("Conta Google inválida","<p class='error'>O email da conta Google não está verificado.</p>");
   user=await env.DB.prepare("SELECT id,name,email,password_hash,password_salt,status,deletion_requested_at,totp_enabled,totp_secret,totp_recovery_hashes FROM users WHERE google_sub=? OR email=?").bind(claims.sub,googleEmail).first();
   if(user&&user.status==="active")await env.DB.prepare("UPDATE users SET google_sub=COALESCE(google_sub,?) WHERE id=?").bind(claims.sub,user.id).run();
 }else{
   user=await env.DB.prepare("SELECT id,name,email,password_hash,password_salt,status,deletion_requested_at,totp_enabled,totp_secret,totp_recovery_hashes FROM users WHERE email=?").bind(email).first();
   if(!user||user.status!=="active"||user.deletion_requested_at||!password||await passHash(password,user.password_salt)!==user.password_hash)return formPage("Não foi possível autorizar","<p class='error'>Email ou palavra-passe incorretos, ou conta indisponível. Volta a tentar.</p>");
 }
 if(!user||user.status!=="active"||user.deletion_requested_at)return formPage("Conta indisponível","<p class=\"error\">Não foi encontrada uma conta ativa com estes dados. Cria primeiro a tua conta no AquiPay.</p>");
 if(user.totp_enabled){
   let ok=false;try{const secret=await decryptTotp(user.totp_secret,env);ok=await verifyTotp(secret,code)}catch{}
   if(!ok){let codes=[];try{codes=JSON.parse(user.totp_recovery_hashes||"[]")}catch{}const normalized=code.toUpperCase().replace(/[^A-Z2-7]/g,""),candidate=normalized?await hash(normalized):"",i=codes.indexOf(candidate);if(i>=0){codes.splice(i,1);await env.DB.prepare("UPDATE users SET totp_recovery_hashes=? WHERE id=?").bind(JSON.stringify(codes),user.id).run();ok=true}}
   if(!ok)return formPage("Verificação necessária","<p class='error'>Código de autenticação inválido. Introduz o código atual da tua aplicação autenticadora.</p>");
 }
 const scopes=approved.join(" "),now=new Date().toISOString(),codeRaw=rand(),expires=new Date(Date.now()+300000).toISOString();
 await env.DB.batch([
  env.DB.prepare("INSERT INTO oauth_consents(user_id,client_id,scopes,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,client_id) DO UPDATE SET scopes=excluded.scopes,updated_at=excluded.updated_at").bind(user.id,clientId,scopes,now),
  env.DB.prepare("INSERT INTO oauth_codes(code_hash,client_id,user_id,redirect_uri,code_challenge,scopes,expires_at,resource) VALUES(?,?,?,?,?,?,?,?)").bind(await hash(codeRaw),clientId,user.id,redirectUri,challenge,scopes,expires,resource)
 ]);
 return redirectWith(redirectUri,{code:codeRaw,state});
}
async function tokenPost(req,env){
 const form=new URLSearchParams(await req.text()),grant=form.get("grant_type")||"",clientId=form.get("client_id")||"";
 if(!clientId)return json({error:"invalid_client"},401);
 const client=await getClient(env,clientId);if(!client)return json({error:"invalid_client"},401);
 if(grant==="authorization_code"){
  const code=form.get("code")||"",redirectUri=form.get("redirect_uri")||"",verifier=form.get("code_verifier")||"",resource=form.get("resource")||"https://aquipay-api.osamariches.workers.dev/mcp";
  if(!code||!verifier||verifier.length<43||verifier.length>128)return json({error:"invalid_grant"});
  const row=await env.DB.prepare("SELECT * FROM oauth_codes WHERE code_hash=? AND client_id=? AND redirect_uri=? AND resource=? AND expires_at>?").bind(await hash(code),clientId,redirectUri,resource,new Date().toISOString()).first();
  if(!row)return json({error:"invalid_grant"});
  const challenge=b64(await crypto.subtle.digest("SHA-256",enc.encode(verifier)));
  if(challenge!==row.code_challenge)return json({error:"invalid_grant"});
  const deleted=await env.DB.prepare("DELETE FROM oauth_codes WHERE code_hash=? AND client_id=?").bind(await hash(code),clientId).run();
  if(!deleted.meta?.changes)return json({error:"invalid_grant"});
  const access=rand(),refresh=rand(),now=Date.now(),accessExpiry=new Date(now+900000).toISOString(),refreshExpiry=new Date(now+30*86400000).toISOString();
  await env.DB.prepare("INSERT INTO oauth_tokens(id,client_id,user_id,scopes,access_hash,refresh_hash,access_expires_at,refresh_expires_at,resource) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),clientId,row.user_id,row.scopes,await hash(access),await hash(refresh),accessExpiry,refreshExpiry,row.resource).run();
  return json({access_token:access,token_type:"Bearer",expires_in:900,refresh_token:refresh,scope:row.scopes});
 }
 if(grant==="refresh_token"){
  const refresh=form.get("refresh_token")||"",resource=form.get("resource")||"https://aquipay-api.osamariches.workers.dev/mcp",row=await env.DB.prepare("SELECT * FROM oauth_tokens WHERE refresh_hash=? AND client_id=? AND resource=? AND revoked_at IS NULL AND refresh_expires_at>?").bind(await hash(refresh),clientId,resource,new Date().toISOString()).first();
  if(!row)return json({error:"invalid_grant"});
  const access=rand(),nextRefresh=rand(),accessExpiry=new Date(Date.now()+900000).toISOString(),refreshExpiry=new Date(Date.now()+30*86400000).toISOString();
  const changed=await env.DB.prepare("UPDATE oauth_tokens SET access_hash=?,refresh_hash=?,access_expires_at=?,refresh_expires_at=?,last_used_at=? WHERE id=? AND refresh_hash=? AND revoked_at IS NULL").bind(await hash(access),await hash(nextRefresh),accessExpiry,refreshExpiry,new Date().toISOString(),row.id,await hash(refresh)).run();
  if(!changed.meta?.changes)return json({error:"invalid_grant"});
  return json({access_token:access,token_type:"Bearer",expires_in:900,refresh_token:nextRefresh,scope:row.scopes});
 }
 return json({error:"unsupported_grant_type"});
}
async function revokePost(req,env){
 const form=new URLSearchParams(await req.text()),token=form.get("token")||"",clientId=form.get("client_id")||"";
 if(token&&clientId){const h=await hash(token);await env.DB.prepare("UPDATE oauth_tokens SET revoked_at=? WHERE client_id=? AND (access_hash=? OR refresh_hash=?) AND revoked_at IS NULL").bind(new Date().toISOString(),clientId,h,h).run()}
 return new Response(null,{status:200,headers:{"cache-control":"no-store"}});
}
export async function handleOAuthRequest(req,env){
 const u=new URL(req.url),p=u.pathname,m=req.method;
 if(p==="/.well-known/oauth-authorization-server"&&m==="GET")return json({
  issuer:"https://aquipay-api.osamariches.workers.dev",
  authorization_endpoint:"https://aquipay-api.osamariches.workers.dev/oauth/authorize",
  token_endpoint:"https://aquipay-api.osamariches.workers.dev/oauth/token",
  registration_endpoint:"https://aquipay-api.osamariches.workers.dev/oauth/register",
  revocation_endpoint:"https://aquipay-api.osamariches.workers.dev/oauth/revoke",
  response_types_supported:["code"],response_modes_supported:["query"],grant_types_supported:["authorization_code","refresh_token"],
  token_endpoint_auth_methods_supported:["none"],code_challenge_methods_supported:["S256"],scopes_supported:OAUTH_SCOPES
 });
 if(p==="/.well-known/oauth-protected-resource"||p==="/.well-known/oauth-protected-resource/mcp")return json({resource:"https://aquipay-api.osamariches.workers.dev/mcp",authorization_servers:["https://aquipay-api.osamariches.workers.dev"],scopes_supported:OAUTH_SCOPES,bearer_methods_supported:["header"]});
 if(p==="/oauth/register"&&m==="POST"){
  const ip=req.headers.get("cf-connecting-ip")||"unknown",key="oauth_register:"+ip+":"+Math.floor(Date.now()/3600000);
  const rate=await env.DB.prepare("INSERT INTO rate_limits(k,n,exp) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n").bind(key,Date.now()+7200000).first();
  if(rate?.n>30)return json({error:"rate_limited"},429);
  let b;try{b=await req.json()}catch{return json({error:"invalid_request"},400)}
  const name=String(b.client_name||"MCP client").trim().slice(0,100),uris=Array.isArray(b.redirect_uris)?[...new Set(b.redirect_uris.filter(x=>typeof x==="string"&&urlOk(x)))]:[];
  if(!name||!uris.length||uris.length!==b.redirect_uris.length||uris.length>10)return json({error:"invalid_redirect_uri"},400);
  const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO oauth_clients(client_id,client_name,redirect_uris) VALUES(?,?,?)").bind(id,name,JSON.stringify(uris)).run();
  return json({client_id:id,client_id_issued_at:Math.floor(Date.now()/1000),client_name:name,redirect_uris:uris,grant_types:["authorization_code","refresh_token"],response_types:["code"],token_endpoint_auth_method:"none"},201);
 }
 if(p==="/oauth/authorize"&&m==="GET")return authorizeGet(req,env);
 if(p==="/oauth/authorize"&&m==="POST")return authorizePost(req,env);
 if(p==="/oauth/token"&&m==="POST")return tokenPost(req,env);
 if(p==="/oauth/revoke"&&m==="POST")return revokePost(req,env);
 return null;
}
