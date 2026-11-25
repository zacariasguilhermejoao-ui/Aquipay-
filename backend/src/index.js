import { handleGooglePlayBilling } from "./google-play-billing.js";
export { CallRoom } from "./call-room.js";
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"strict-origin-when-cross-origin","strict-transport-security":"max-age=63072000; includeSubDomains; preload"};
const enc=new TextEncoder();
const out=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...H,...extra}});
const err=(message,status=400)=>out({error:message},status);
const uid=()=>crypto.randomUUID();
const b64=b=>{let s='';for(const x of new Uint8Array(b))s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')};
const digest=async s=>b64(await crypto.subtle.digest('SHA-256',enc.encode(s)));
async function passHash(p,s){const k=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']);return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(s),iterations:100000,hash:'SHA-256'},k,256))}
async function json(req,max=30000){const s=await req.text();if(s.length>max)throw Error('too_large');return JSON.parse(s||'{}')}
const clean=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
const emailOk=s=>/^\S+@\S+\.\S+$/.test(s)&&s.length<=254;
async function session(userId,env){const token=b64(crypto.getRandomValues(new Uint8Array(32))),expires=new Date(Date.now()+7*86400000).toISOString();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),userId,expires).run();return{token,expiresAt:expires}}

const TOTP_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=TOTP_ALPHABET[(value>>>(bits-5))&31];bits-=5}}if(bits)out+=TOTP_ALPHABET[(value<<(5-bits))&31];return out}
function base32Decode(value){const s=String(value||'').toUpperCase().replace(/=+$/,'').replace(/[^A-Z2-7]/g,'');let bits=0,v=0,out=[];for(const ch of s){const n=TOTP_ALPHABET.indexOf(ch);if(n<0)continue;v=(v<<5)|n;bits+=5;if(bits>=8){out.push((v>>>(bits-8))&255);bits-=8}}return new Uint8Array(out)}
async function totpEncryptionKey(env){if(!env.TOTP_ENCRYPTION_KEY)throw Error('totp_key_missing');const raw=b64d(env.TOTP_ENCRYPTION_KEY);if(raw.length!==32)throw Error('totp_key_invalid');return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt'])}
async function encryptTotpSecret(secret,env){const key=await totpEncryptionKey(env),iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(secret));return b64(cat(iv,new Uint8Array(cipher)))}
async function decryptTotpSecret(value,env){const raw=b64d(value||'');if(raw.length<29)throw Error('totp_cipher_invalid');const key=await totpEncryptionKey(env),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));return new TextDecoder().decode(plain)}
async function totpAt(secret,step){const key=await crypto.subtle.importKey('raw',base32Decode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']),counter=new Uint8Array(8);new DataView(counter.buffer).setBigUint64(0,BigInt(step),false);const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter)),offset=mac[mac.length-1]&15,binary=((mac[offset]&127)<<24)|((mac[offset+1]&255)<<16)|((mac[offset+2]&255)<<8)|(mac[offset+3]&255);return String(binary%1000000).padStart(6,'0')}
async function verifyTotp(secret,code){const c=String(code||'').replace(/\s/g,'');if(!/^\d{6}$/.test(c))return false;const step=Math.floor(Date.now()/30000);for(let d=-1;d<=1;d++)if(await totpAt(secret,step+d)===c)return true;return false}
async function verifyAccountCode(user,code,env){if(user.totp_enabled&&user.totp_secret){const secret=await decryptTotpSecret(user.totp_secret,env);if(await verifyTotp(secret,code))return {ok:true,recovery:false}}let hashes=[];try{hashes=JSON.parse(user.totp_recovery_hashes||'[]')}catch{}const normalized=String(code||'').toUpperCase().replace(/[^A-Z2-7]/g,''),h=normalized?await digest(normalized):'';const i=hashes.indexOf(h);if(i>=0){hashes.splice(i,1);await env.DB.prepare('UPDATE users SET totp_recovery_hashes=? WHERE id=?').bind(JSON.stringify(hashes),user.id).run();return {ok:true,recovery:true}}return {ok:false,recovery:false}}
function makeRecoveryCodes(){return Array.from({length:10},()=>{const s=base32Encode(crypto.getRandomValues(new Uint8Array(10)));return s.slice(0,5)+'-'+s.slice(5,10)+'-'+s.slice(10,16)})}
async function issueLoginChallenge(userId,env){const id=b64(crypto.getRandomValues(new Uint8Array(24)));await env.DB.prepare('INSERT INTO auth_challenges(id,user_id,expires_at) VALUES(?,?,?)').bind(id,userId,new Date(Date.now()+5*60000).toISOString()).run();return out({requiresTwoFactor:true,challengeId:id,expiresIn:300})}
function angolaPeriodStart(period){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Luanda',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const date=period==='month'?`${parts.year}-${parts.month}-01`:`${parts.year}-${parts.month}-${parts.day}`;return new Date(`${date}T00:00:00+01:00`).toISOString()}
async function plusIsActive(env,userId){const r=await env.DB.prepare("SELECT 1 active FROM user_subscriptions WHERE user_id=? AND status='active' AND expires_at>? LIMIT 1").bind(userId,new Date().toISOString()).first();return !!r}
async function current(req,env){const h=req.headers.get('authorization')||'',t=h.startsWith('Bearer ')?h.slice(7):'';if(!t)return null;return env.DB.prepare("SELECT u.id,u.name,u.email,u.deletion_requested_at,u.deletion_due_at,u.onboarding_completed_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'").bind(await digest(t),new Date().toISOString()).first()}
async function notice(env,userId,kind,title,body,data={}){const active=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active' AND deletion_requested_at IS NULL").bind(userId).first();if(!active)return;await env.DB.prepare('INSERT INTO notifications(id,user_id,kind,title,body,data_json) VALUES(?,?,?,?,?,?)').bind(uid(),userId,kind,title.slice(0,100),body.slice(0,500),JSON.stringify(data)).run();await pushTo(env,userId,kind,title,body,data)}
async function limited(req,env,name,max,sec){
  const ip=req.headers.get('cf-connecting-ip')||'unknown',now=Date.now(),k=name+':'+ip+':'+Math.floor(now/(sec*1000));
  const r=await env.DB.prepare('INSERT INTO rate_limits(k,n,exp) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n').bind(k,now+sec*2000).first();
  if(Math.random()<0.02)await env.DB.prepare('DELETE FROM rate_limits WHERE exp<?').bind(now).run();
  return r&&r.n>max?err('Demasiadas tentativas. Tenta novamente mais tarde.',429):null;
}
const b64d=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function googleClaims(cred,clientId){
  const parts=String(cred).split('.');if(parts.length!==3)throw Error('jwt');
  const header=JSON.parse(new TextDecoder().decode(b64d(parts[0]))),c=JSON.parse(new TextDecoder().decode(b64d(parts[1])));
  if(header.alg!=='RS256'||!header.kid)throw Error('alg');
  const jwks=await (await fetch('https://www.googleapis.com/oauth2/v3/certs',{cf:{cacheTtl:3600,cacheEverything:true}})).json();
  const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid);if(!jwk)throw Error('kid');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64d(parts[2]),enc.encode(parts[0]+'.'+parts[1])))throw Error('sig');
  if(!['accounts.google.com','https://accounts.google.com'].includes(c.iss)||!String(clientId).split(',').map(x=>x.trim()).filter(Boolean).includes(c.aud)||!(c.exp>Date.now()/1000)||!c.sub)throw Error('claims');
  return c;
}
async function googleAuth(req,env){
  if(!env.GOOGLE_CLIENT_ID)return err('O início de sessão com Google ainda não está configurado.',503);
  const rl=await limited(req,env,'google',20,900);if(rl)return rl;
  const b=await json(req,8000);let c;
  try{c=await googleClaims(typeof b.credential==='string'?b.credential:'',env.GOOGLE_CLIENT_ID)}catch{return err('Credencial Google inválida.',401)}
  const email=String(c.email||'').toLowerCase();
  if(c.email_verified!==true&&c.email_verified!=='true'||!emailOk(email))return err('O email da conta Google não está verificado.',403);
  let u=await env.DB.prepare('SELECT id,name,email,status,deletion_requested_at,deletion_due_at FROM users WHERE google_sub=?').bind(c.sub).first(),created=false;
  if(!u){
    u=await env.DB.prepare('SELECT id,name,email,status,deletion_requested_at,deletion_due_at FROM users WHERE email=?').bind(email).first();
    if(u&&u.status==='active')await env.DB.prepare('UPDATE users SET google_sub=? WHERE id=? AND google_sub IS NULL').bind(c.sub,u.id).run();
  }
  if(!u){
    const id=uid(),name=clean(c.name,80)||email.split('@')[0],salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=b64(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.batch([env.DB.prepare('INSERT INTO users(id,name,email,password_hash,password_salt,google_sub) VALUES(?,?,?,?,?,?)').bind(id,name.length>=2?name:email,email,hash,salt,c.sub),env.DB.prepare('INSERT INTO profiles(user_id) VALUES(?)').bind(id),env.DB.prepare('INSERT INTO wallets(user_id,available_coins) VALUES(?,10)').bind(id),env.DB.prepare("INSERT INTO wallet_ledger(id,user_id,event_type,amount_coins,reference,idempotency_key,status) VALUES(?,?,'welcome_bonus',10,'signup',?,'posted')").bind(uid(),id,'welcome:'+id)]);
    u={id,name,email,status:'active'};created=true;
  }
  if(u.status!=='active')return err('Conta indisponível.',403);
  const security=await env.DB.prepare('SELECT totp_enabled FROM users WHERE id=?').bind(u.id).first();
  if(security?.totp_enabled)return issueLoginChallenge(u.id,env);
  return out({user:{id:u.id,name:u.name,email:u.email,deletionRequestedAt:u.deletion_requested_at||null,deletionDueAt:u.deletion_due_at||null},...await session(u.id,env)},created?201:200);
}
const PUSH_HOSTS=['googleapis.com','mozilla.com','push.apple.com','windows.com','samsung.com'];
const PUSH_PREF={proposal:'candidaturas',proposal_status:'candidaturas',rating:'candidaturas',message:'mensagens',call:'mensagens',post:'novidades'};
const Z=new Uint8Array([0]);
const cat=(...a)=>{const o=new Uint8Array(a.reduce((t,x)=>t+x.length,0));let i=0;for(const x of a){o.set(x,i);i+=x.length}return o};
async function hkdf(salt,ikm,info,len){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,len*8))}
async function vapidAuth(env,endpoint){
  const h=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'}))),p=b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+43200,sub:env.APP_ORIGIN})));
  const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE_KEY),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const sig=b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(h+'.'+p)));
  return 'vapid t='+h+'.'+p+'.'+sig+', k='+env.VAPID_PUBLIC_KEY;
}
async function encryptPush(sub,payload){
  const ua=b64d(sub.p256dh),auth=b64d(sub.auth);
  const eph=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const asPub=new Uint8Array(await crypto.subtle.exportKey('raw',eph.publicKey));
  const uaKey=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const secret=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},eph.privateKey,256));
  const ikm=await hkdf(auth,secret,cat(enc.encode('WebPush: info'),Z,ua,asPub),32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const cek=await hkdf(salt,ikm,cat(enc.encode('Content-Encoding: aes128gcm'),Z),16),nonce=await hkdf(salt,ikm,cat(enc.encode('Content-Encoding: nonce'),Z),12);
  const ck=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},ck,cat(enc.encode(payload),new Uint8Array([2]))));
  return cat(salt,new Uint8Array([0,0,16,0,65]),asPub,ct);
}
async function sendPush(env,sub,payload){
  return fetch(sub.endpoint,{method:'POST',headers:{'content-encoding':'aes128gcm','content-type':'application/octet-stream','ttl':'86400','urgency':'normal','authorization':await vapidAuth(env,sub.endpoint)},body:await encryptPush(sub,payload),signal:AbortSignal.timeout(5000)});
}
let fcmAccessToken='',fcmAccessTokenExp=0;
function decodeB64(value){
  const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
}
async function firebaseCredentials(env){
  if(!env.FIREBASE_SERVICE_ACCOUNT_B64)throw Error('firebase_secret_missing');
  const raw=atob(String(env.FIREBASE_SERVICE_ACCOUNT_B64).replace(/\s/g,''));
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const account=JSON.parse(new TextDecoder().decode(bytes));
  if(account.type!=='service_account'||!account.project_id||!account.client_email||!account.private_key)throw Error('firebase_credentials_invalid');
  return account;
}
async function firebaseAccessToken(account){
  if(fcmAccessToken&&fcmAccessTokenExp>Date.now()+60000)return fcmAccessToken;
  const now=Math.floor(Date.now()/1000);
  const head=b64(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const claim=b64(enc.encode(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
  const unsigned=head+'.'+claim;
  const pem=account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',decodeB64(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(unsigned)));
  const assertion=unsigned+'.'+signature;
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(8000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.access_token)throw Error('firebase_oauth_failed');
  fcmAccessToken=data.access_token;fcmAccessTokenExp=Date.now()+Number(data.expires_in||3600)*1000;
  return fcmAccessToken;
}
async function sendFcm(env,account,token,payload){
  const access=await firebaseAccessToken(account);
  return fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(account.project_id)+'/messages:send',{
    method:'POST',headers:{authorization:'Bearer '+access,'content-type':'application/json'},
    body:JSON.stringify({message:{token,notification:{title:payload.title,body:payload.body},data:{url:String(payload.url||'/'),kind:String(payload.kind||'novidades'),callId:String(payload.callId||''),callType:String(payload.callType||''),conversationId:String(payload.conversationId||'')},android:{priority:'HIGH',notification:{channel_id:'default',sound:'default'}}}}),
    signal:AbortSignal.timeout(8000)
  });
}
async function registerFcmToken(req,env,me){
  const b=await json(req,5000),token=clean(b.token,4096),platform=clean(b.platform,20)||'android',pr=b.prefs||{};
  if(token.length<40||platform!=='android')return err('Token FCM inválido.');
  const prefs=JSON.stringify({candidaturas:pr.candidaturas!==false,pagamentos:pr.pagamentos!==false,mensagens:pr.mensagens!==false,novidades:pr.novidades===true});
  await env.DB.prepare("INSERT INTO fcm_tokens(token,user_id,platform,prefs) VALUES(?,?,?,?) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,platform=excluded.platform,prefs=excluded.prefs,created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(token,me.id,platform,prefs).run();
  await env.DB.prepare('DELETE FROM fcm_tokens WHERE user_id=? AND token NOT IN (SELECT token FROM fcm_tokens WHERE user_id=? ORDER BY created_at DESC LIMIT 5)').bind(me.id,me.id).run();
  return out({ok:true},201);
}
async function pushTo(env,userId,kind,title,body,data={}){
  const pref=PUSH_PREF[kind]||'novidades',payload={title:title.slice(0,80),body:body.slice(0,200),url:String(data.url||'/'),kind,callId:String(data.callId||''),callType:String(data.callType||''),conversationId:String(data.conversationId||'')};
  const jobs=[];
  if(env.VAPID_PRIVATE_KEY&&env.VAPID_PUBLIC_KEY){
    jobs.push((async()=>{
      const subs=await env.DB.prepare('SELECT endpoint,p256dh,auth,prefs FROM push_subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT 5').bind(userId).all();
      await Promise.allSettled(subs.results.map(async s=>{
        let prefs={};try{prefs=JSON.parse(s.prefs||'{}')}catch{}
        if(prefs[pref]===false)return;
        const r=await sendPush(env,s,JSON.stringify(payload));
        if(r.status===404||r.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(s.endpoint).run();
      }));
    })());
  }
  if(env.FIREBASE_SERVICE_ACCOUNT_B64){
    jobs.push((async()=>{
      const [account,tokens]=await Promise.all([firebaseCredentials(env),env.DB.prepare('SELECT token,prefs FROM fcm_tokens WHERE user_id=? ORDER BY created_at DESC LIMIT 5').bind(userId).all()]);
      await Promise.allSettled(tokens.results.map(async row=>{
        let prefs={};try{prefs=JSON.parse(row.prefs||'{}')}catch{}
        if(prefs[pref]===false)return;
        const r=await sendFcm(env,account,row.token,payload);
        if(r.status===404||r.status===400){
          const d=await r.json().catch(()=>({}));
          if(JSON.stringify(d).includes('UNREGISTERED'))await env.DB.prepare('DELETE FROM fcm_tokens WHERE token=?').bind(row.token).run();
        }
      }));
    })());
  }
  try{await Promise.allSettled(jobs)}catch(e){console.error('push',e)}
}
async function pushSubscribe(req,env,me){
  const b=await json(req,4000),s=b.subscription||{},ep=clean(s.endpoint,600),k=s.keys||{},p256=clean(k.p256dh,200),au=clean(k.auth,60),pr=b.prefs||{};
  let host='';try{const x=new URL(ep);if(x.protocol==='https:')host=x.hostname}catch{}
  if(!host||!PUSH_HOSTS.some(h=>host===h||host.endsWith('.'+h))||!p256||!au)return err('Subscrição inválida.');
  const prefs=JSON.stringify({candidaturas:pr.candidaturas!==false,pagamentos:pr.pagamentos!==false,mensagens:pr.mensagens!==false,novidades:pr.novidades===true});
  await env.DB.prepare("INSERT INTO push_subscriptions(endpoint,user_id,p256dh,auth,prefs) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,prefs=excluded.prefs,created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(ep,me.id,p256,au,prefs).run();
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint NOT IN (SELECT endpoint FROM push_subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT 5)').bind(me.id,me.id).run();
  return out({ok:true},201);
}
const MAILS={
pt:['Recupera a tua palavra-passe do Aquipay','Olá {n},\n\nRecebemos um pedido para criar uma nova palavra-passe. Abre este link (válido durante 1 hora):\n{l}\n\nSe não foste tu, ignora este email: a tua conta continua segura.\n\nEquipa Aquipay'],
en:['Reset your Aquipay password','Hi {n},\n\nWe received a request to set a new password. Open this link (valid for 1 hour):\n{l}\n\nIf this wasn’t you, ignore this email: your account is still safe.\n\nThe Aquipay team'],
fr:['Réinitialisez votre mot de passe Aquipay','Bonjour {n},\n\nNous avons reçu une demande de nouveau mot de passe. Ouvrez ce lien (valable 1 heure) :\n{l}\n\nSi ce n’était pas vous, ignorez cet e-mail : votre compte reste en sécurité.\n\nL’équipe Aquipay'],
zh:['重置你的 Aquipay 密码','你好 {n}，\n\n我们收到了设置新密码的请求。请打开此链接（1 小时内有效）：\n{l}\n\n如果不是你本人操作，请忽略此邮件，你的账户依然安全。\n\nAquipay 团队']};
async function sendReset(env,email,name,token,lang){
  const link=env.APP_ORIGIN+'/?reset='+encodeURIComponent(token)+'&lang='+lang,[subject,body]=MAILS[lang]||MAILS.pt,text=body.replace('{n}',name).replace('{l}',link);
  if(!env.EMAIL){console.warn('Aquipay: binding EMAIL em falta; email de recuperação não enviado.');return}
  try{await env.EMAIL.send({to:email,from:{email:env.MAIL_FROM||'no-reply@isabstudio.dev',name:'Aquipay'},subject,text,html:'<p>'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;').split('\n\n').join('</p><p>').replace(/\n/g,'<br>').replace(link,'<a href="'+link+'">'+link+'</a>')+'</p>'})}catch(e){console.error('Aquipay email',e.code||'',e.message)}
}
async function api(req,env,ctx){const u=new URL(req.url),p=u.pathname,m=req.method;
 if(p==='/api/health'&&m==='GET')return out({ok:true,service:'aquipay-api'});
 const listingMediaPublic=p.match(/^\/api\/listing-media\/([\w-]+)\/([\w-]+)$/);if(listingMediaPublic&&m==='GET'){const row=await env.DB.prepare("SELECT media_json FROM listings WHERE id=? AND status='active'").bind(listingMediaPublic[1]).first();if(!row)return err('Imagem não encontrada.',404);let media=[];try{media=JSON.parse(row.media_json||'[]')}catch{}const item=media.find(x=>x.id===listingMediaPublic[2]);if(!item)return err('Imagem não encontrada.',404);const obj=await env.MEDIA.get(item.key);if(!obj)return err('Imagem não encontrada.',404);return new Response(obj.body,{headers:{'content-type':item.type||'image/jpeg','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}})}
 const avatarPublic=p.match(/^\/api\/avatars\/([\w-]+)$/);if(avatarPublic&&m==='GET'){const row=await env.DB.prepare("SELECT p.avatar_key FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND u.status='active' AND u.deletion_requested_at IS NULL").bind(avatarPublic[1]).first();if(!row?.avatar_key)return err('Foto não encontrada.',404);const obj=await env.MEDIA.get(row.avatar_key);if(!obj)return err('Foto não encontrada.',404);return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}})}
 if(p==='/api/account-deletion/request'&&m==='POST'){
  const rl=await limited(req,env,'external-del',5,3600);if(rl)return rl;
  const b=await json(req,9000);let x=null;
  if(typeof b.credential==='string'&&b.credential){
    if(!env.GOOGLE_CLIENT_ID)return err('O início de sessão com Google não está configurado.',503);
    let c;try{c=await googleClaims(b.credential,env.GOOGLE_CLIENT_ID)}catch{return err('Credencial Google inválida.',401)}
    const email=String(c.email||'').toLowerCase();if(c.email_verified!==true&&c.email_verified!=='true'||!emailOk(email))return err('Email Google não verificado.',403);
    x=await env.DB.prepare('SELECT id,status,deletion_requested_at,deletion_due_at,totp_enabled,totp_secret,totp_recovery_hashes FROM users WHERE google_sub=? OR email=?').bind(c.sub,email).first();
    if(x&&x.status==='active')await env.DB.prepare('UPDATE users SET google_sub=COALESCE(google_sub,?) WHERE id=?').bind(c.sub,x.id).run();
  }else{
    const email=clean(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'';
    if(!emailOk(email)||!password)return err('Indica o email e a palavra-passe da conta.');
    x=await env.DB.prepare('SELECT id,status,password_hash,password_salt,deletion_requested_at,deletion_due_at,totp_enabled,totp_secret,totp_recovery_hashes FROM users WHERE email=?').bind(email).first();
    if(!x||x.status!=='active'||await passHash(password,x.password_salt)!==x.password_hash)return err('Email ou palavra-passe incorretos.',401);
  }
  if(!x||x.status!=='active')return err('Não foi encontrada uma conta ativa para esses dados.',404);if(x.totp_enabled){const checked=await verifyAccountCode(x,b.code,env);if(!checked.ok)return err('Código do autenticador obrigatório ou incorreto.',403)}
  if(x.deletion_requested_at)return out({ok:true,alreadyRequested:true,deletionRequestedAt:x.deletion_requested_at,deletionDueAt:x.deletion_due_at});
  const now=new Date(),due=new Date(now.getTime()+30*86400000).toISOString(),requested=now.toISOString();
  await env.DB.prepare('UPDATE users SET deletion_requested_at=?,deletion_due_at=? WHERE id=? AND status=\'active\'').bind(requested,due,x.id).run();
  return out({ok:true,deletionRequestedAt:requested,deletionDueAt:due});
 }
 // Pesquisa e perfil público: apenas dados profissionais publicados pelo próprio titular.
 if(p==='/api/users'&&m==='GET'){const q=clean(u.searchParams.get('q'),80);if(q.length<2)return out({users:[]});const viewer=await current(req,env).catch(()=>null);const r=await env.DB.prepare("SELECT u.id,u.name,p.city,p.bio,p.professions_json,p.skills_json,p.portfolio_json,p.experience_json,p.education_json,p.updated_at FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.status='active' AND u.deletion_requested_at IS NULL AND p.public_profile=1 AND (u.name LIKE '%'||?||'%' OR p.city LIKE '%'||?||'%' OR p.bio LIKE '%'||?||'%' OR p.professions_json LIKE '%'||?||'%') AND (? IS NULL OR (u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?) AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id=?))) ORDER BY u.name LIMIT 30").bind(q,q,q,q,viewer?viewer.id:null,viewer?viewer.id:null,viewer?viewer.id:null).all();return out({users:r.results})}
 const publicDoc=p.match(/^\/api\/public-documents\/([\w-]+)$/);if(publicDoc&&m==='GET'){const d=await env.DB.prepare('SELECT d.original_name,d.content_type,d.object_key,d.size_bytes FROM documents d JOIN profiles p ON p.user_id=d.user_id AND p.public_profile=1 JOIN users u ON u.id=d.user_id AND u.status=\'active\' AND u.deletion_requested_at IS NULL WHERE d.id=? AND d.is_public=1').bind(publicDoc[1]).first();if(!d)return err('Documento público não encontrado.',404);const obj=await env.MEDIA.get(d.object_key);if(!obj)return err('Ficheiro não encontrado.',404);return new Response(obj.body,{headers:{'content-type':d.content_type,'content-length':String(d.size_bytes),'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.original_name)}`,'cache-control':'public, max-age=300','x-content-type-options':'nosniff'}})}
 const pub=p.match(/^\/api\/users\/([\w-]+)$/);if(pub&&m==='GET'){const r=await env.DB.prepare("SELECT u.id,u.name,u.created_at,p.city,p.bio,p.professions_json,p.skills_json,p.portfolio_json,p.experience_json,p.education_json,CASE WHEN p.avatar_key IS NOT NULL THEN '/api/avatars/'||u.id ELSE NULL END avatar_url FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=? AND u.status='active' AND u.deletion_requested_at IS NULL AND p.public_profile=1").bind(pub[1]).first();if(!r)return err('Perfil não encontrado ou privado.',404);const viewer=await current(req,env).catch(()=>null),[followers,following,isFollowing]=await Promise.all([env.DB.prepare('SELECT COUNT(*) n FROM user_follows WHERE followed_id=?').bind(pub[1]).first(),env.DB.prepare('SELECT COUNT(*) n FROM user_follows WHERE follower_id=?').bind(pub[1]).first(),viewer&&viewer.id!==pub[1]?env.DB.prepare('SELECT 1 ok FROM user_follows WHERE follower_id=? AND followed_id=?').bind(viewer.id,pub[1]).first():Promise.resolve(null)]);const [rating,reviews,docs,earnings]=await Promise.all([env.DB.prepare('SELECT COUNT(*) count,ROUND(AVG(stars),1) average FROM profile_ratings WHERE target_user_id=?').bind(pub[1]).first(),env.DB.prepare('SELECT r.stars,r.comment,r.created_at,u.name reviewer_name FROM profile_ratings r JOIN users u ON u.id=r.reviewer_user_id WHERE r.target_user_id=? ORDER BY r.created_at DESC LIMIT 20').bind(pub[1]).all(),env.DB.prepare('SELECT id,category,original_name,content_type,size_bytes,created_at FROM documents WHERE user_id=? AND is_public=1 ORDER BY created_at DESC').bind(pub[1]).all(),env.DB.prepare("SELECT COALESCE(SUM(COALESCE(p.price_minor,l.price_minor,0)),0) total_minor,COUNT(*) completed_count FROM proposals p JOIN listings l ON l.id=p.listing_id WHERE p.status='completed' AND COALESCE(p.price_minor,l.price_minor,0)>0 AND ((l.kind='job' AND p.sender_id=?) OR (l.kind IN ('service','product') AND p.receiver_id=?))").bind(pub[1],pub[1]).first()]);return out({profile:r,network:{followersCount:Number(followers?.n||0),followingCount:Number(following?.n||0),isFollowing:!!isFollowing},ratings:{count:rating.count,average:rating.average||0,reviews:reviews.results},documents:docs.results,earnings:{totalMinor:Number(earnings?.total_minor||0),completedCount:Number(earnings?.completed_count||0),currency:'AOA'}})}
 if(p==='/api/auth/google'&&m==='POST')return googleAuth(req,env);
 if(p==='/api/auth/2fa/verify'&&m==='POST'){
  const rl=await limited(req,env,'2fa_verify',12,900);if(rl)return rl;
  const b=await json(req,3000),id=clean(b.challengeId,100),code=clean(b.code,40),ch=await env.DB.prepare('SELECT id,user_id,expires_at,attempts FROM auth_challenges WHERE id=?').bind(id).first();
  if(!ch||ch.expires_at<new Date().toISOString()||ch.attempts>=5)return err('Pedido de verificação expirado. Inicia sessão novamente.',401);
  const user=await env.DB.prepare("SELECT id,name,email,status,deletion_requested_at,deletion_due_at,totp_enabled,totp_secret,totp_recovery_hashes FROM users WHERE id=?").bind(ch.user_id).first();
  if(!user||user.status!=='active'||!user.totp_enabled){await env.DB.prepare('DELETE FROM auth_challenges WHERE id=?').bind(id).run();return err('Não foi possível validar a conta.',401)}
  const checked=await verifyAccountCode(user,code,env);
  if(!checked.ok){const next=ch.attempts+1;await env.DB.prepare('UPDATE auth_challenges SET attempts=? WHERE id=?').bind(next,id).run();if(next>=5)await env.DB.prepare('DELETE FROM auth_challenges WHERE id=?').bind(id).run();return err('Código incorreto. Verifica o autenticador e tenta novamente.',401)}
  await env.DB.prepare('DELETE FROM auth_challenges WHERE id=?').bind(id).run();
  return out({user:{id:user.id,name:user.name,email:user.email,deletionRequestedAt:user.deletion_requested_at||null,deletionDueAt:user.deletion_due_at||null},...await session(user.id,env)});
 }
 if(p==='/api/auth/register'&&m==='POST'){const rl=await limited(req,env,'reg',8,3600);if(rl)return rl;const b=await json(req),name=clean(b.name,80),email=clean(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'';if(name.length<2||!emailOk(email)||password.length<10)return err('Nome, email válido e palavra-passe com pelo menos 10 caracteres são obrigatórios.');const exists=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();if(exists)return err('Email já registado.',409);const id=uid(),salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passHash(password,salt);try{await env.DB.batch([env.DB.prepare('INSERT INTO users(id,name,email,password_hash,password_salt) VALUES(?,?,?,?,?)').bind(id,name,email,hash,salt),env.DB.prepare('INSERT INTO profiles(user_id) VALUES(?)').bind(id),env.DB.prepare('INSERT INTO wallets(user_id,available_coins) VALUES(?,10)').bind(id),env.DB.prepare("INSERT INTO wallet_ledger(id,user_id,event_type,amount_coins,reference,idempotency_key,status) VALUES(?,?,'welcome_bonus',10,'signup',?,'posted')").bind(uid(),id,'welcome:'+id)])}catch{return err('Não foi possível criar a conta.',409)}return out({user:{id,name,email},...await session(id,env)},201)}
 if(p==='/api/auth/login'&&m==='POST'){const rl=await limited(req,env,'login',10,900);if(rl)return rl;const b=await json(req),email=clean(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'';const ar=await limited(req,env,'login_email_'+(await digest(email)).slice(0,18),8,900);if(ar)return ar;const x=await env.DB.prepare("SELECT id,name,email,password_hash,password_salt,status,deletion_requested_at,deletion_due_at,totp_enabled FROM users WHERE email=?").bind(email).first();if(!x||x.status!=='active'||!password||await passHash(password,x.password_salt)!==x.password_hash)return err('Email ou palavra-passe incorretos.',401);if(x.totp_enabled)return issueLoginChallenge(x.id,env);return out({user:{id:x.id,name:x.name,email:x.email,deletionRequestedAt:x.deletion_requested_at||null,deletionDueAt:x.deletion_due_at||null},...await session(x.id,env)})}
 if(p==='/api/auth/forgot'&&m==='POST'){const rl=await limited(req,env,'forgot',5,3600);if(rl)return rl;const b=await json(req,2000),email=clean(b.email,254).toLowerCase(),lang=['pt','en','fr','zh'].includes(b.lang)?b.lang:'pt';if(emailOk(email)){const x=await env.DB.prepare('SELECT id,name,status FROM users WHERE email=?').bind(email).first();if(x&&x.status==='active'){const token=b64(crypto.getRandomValues(new Uint8Array(32)));await env.DB.batch([env.DB.prepare('DELETE FROM password_resets WHERE user_id=?').bind(x.id),env.DB.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),x.id,new Date(Date.now()+3600000).toISOString())]);await sendReset(env,email,x.name,token,lang)}}return out({ok:true})}
 if(p==='/api/auth/reset'&&m==='POST'){const rl=await limited(req,env,'reset',10,3600);if(rl)return rl;const b=await json(req,2000),token=clean(b.token,200),pw=typeof b.password==='string'?b.password:'';if(pw.length<10||pw.length>200)return err('A palavra-passe deve ter pelo menos 10 caracteres.');const r=token?await env.DB.prepare('SELECT pr.user_id,pr.expires_at,u.totp_enabled,u.totp_secret,u.totp_recovery_hashes FROM password_resets pr JOIN users u ON u.id=pr.user_id WHERE pr.token_hash=?').bind(await digest(token)).first():null;if(!r||r.expires_at<new Date().toISOString())return err('Link de recuperação inválido ou expirado.');if(r.totp_enabled){const checked=await verifyAccountCode({id:r.user_id,totp_enabled:r.totp_enabled,totp_secret:r.totp_secret,totp_recovery_hashes:r.totp_recovery_hashes},b.code,env);if(!checked.ok)return err('Código do autenticador obrigatório ou incorreto.',403)}const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passHash(pw,salt);await env.DB.batch([env.DB.prepare("UPDATE users SET password_hash=?,password_salt=? WHERE id=? AND status='active'").bind(hash,salt,r.user_id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(r.user_id),env.DB.prepare('DELETE FROM password_resets WHERE user_id=?').bind(r.user_id)]);return out({ok:true})}
 if(p==='/api/webhooks/didit'&&m==='POST'){
  if(!env.DIDIT_WEBHOOK_SECRET)return err('Webhook Didit não configurado.',503);
  const ts=Number(req.headers.get('x-timestamp')||0),sig=String(req.headers.get('x-signature-v2')||'').toLowerCase();
  if(!Number.isFinite(ts)||!ts||Math.abs(Date.now()/1000-ts)>300||!/^[a-f0-9]{64}$/.test(sig))return err('Assinatura ou data do webhook inválida.',401);
  let payload;try{payload=await req.json()}catch{return err('JSON inválido.',400)}
  const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):typeof v==='number'&&Number.isFinite(v)&&Number.isInteger(v)?Math.trunc(v):v;
  const canonical=JSON.stringify(sortKeys(payload));
  const key=await crypto.subtle.importKey('raw',enc.encode(env.DIDIT_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(canonical)));
  const expected=Array.from(mac,x=>x.toString(16).padStart(2,'0')).join('');
  let diff=expected.length^sig.length;for(let i=0;i<Math.max(expected.length,sig.length);i++)diff|=(expected.charCodeAt(i)||0)^(sig.charCodeAt(i)||0);
  if(diff!==0)return err('Assinatura do webhook inválida.',401);
  const sessionId=clean(payload.session_id||payload.sessionId||payload.session?.id,120);
  const status=clean(payload.status||payload.decision?.status,40);
  const event=clean(payload.webhook_type||payload.event||payload.type,80);
  if(!sessionId||!['Not Started','In Progress','Awaiting User','In Review','Approved','Declined','Resubmitted','Abandoned','Expired','Kyc Expired','Not Finished'].includes(status))return err('Evento Didit incompleto ou com estado inválido.',400);
  const row=await env.DB.prepare('SELECT user_id FROM identity_verifications WHERE session_id=?').bind(sessionId).first();
  if(!row)return out({ok:true,ignored:true});
  const eventKey=await digest(sessionId+':'+event+':'+status);
  const inserted=await env.DB.prepare('INSERT OR IGNORE INTO identity_webhook_events(event_key,session_id,event_type) VALUES(?,?,?)').bind(eventKey,sessionId,event||'status').run();
  if(!inserted.meta?.changes)return out({ok:true,duplicate:true});
  const now=new Date().toISOString();
  await env.DB.prepare('UPDATE identity_verifications SET status=?,updated_at=? WHERE session_id=?').bind(status,now,sessionId).run();
  if(status==='Approved')await env.DB.prepare('UPDATE users SET identity_verified_at=COALESCE(identity_verified_at,?) WHERE id=?').bind(now,row.user_id).run();
  return out({ok:true});
 }
 const wsPath=p==='/api/calls/ws'&&m==='GET';
 if(wsPath){
  if(req.headers.get('Upgrade')!=='websocket')return err('WebSocket necessário.',426);
  const ticket=clean(u.searchParams.get('ticket'),160);
  if(!ticket)return err('Bilhete inválido.',401);
  const hash=await digest(ticket);
  const row=await env.DB.prepare('SELECT t.user_id,t.call_id,c.caller_id,c.callee_id,c.status FROM call_tickets t LEFT JOIN calls c ON c.id=t.call_id WHERE t.token_hash=? AND t.expires_at>?').bind(hash,new Date().toISOString()).first();
  if(!row)return err('Bilhete expirado ou já utilizado.',401);
  await env.DB.prepare('DELETE FROM call_tickets WHERE token_hash=?').bind(hash).run();
  if(row.call_id&&(![row.caller_id,row.callee_id].includes(row.user_id)||!['ringing','active'].includes(row.status)))return err('Chamada indisponível.',403);
  const room=env.CALL_ROOMS.getByName(row.call_id||'user:'+row.user_id);
  const target=new URL('https://call-room/websocket');
  target.searchParams.set('userId',row.user_id);
  target.searchParams.set('roomType',row.call_id?'call':'user');
  return room.fetch(new Request(target,req));
 }
 const me=await current(req,env);if(!me)return err('Sessão inválida ou expirada.',401);
if(me.deletion_requested_at&&!(p==='/api/me/deletion'&&m==='GET')&&!(p==='/api/me/deletion/cancel'&&m==='POST')&&!(p==='/api/auth/logout'&&m==='POST'))return err('Esta conta está marcada para eliminação. Cancela o pedido para voltar a utilizá-la.',423);
if(p==='/api/calls/ice'&&m==='GET'){
 if(!env.CALL_TURN_KEY_ID||!env.CALL_TURN_KEY_SECRET)return out({iceServers:[{urls:['stun:stun.cloudflare.com:3478']}]});
 const response=await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(env.CALL_TURN_KEY_ID)+'/credentials/generate-ice-servers',{method:'POST',headers:{authorization:'Bearer '+env.CALL_TURN_KEY_SECRET,'content-type':'application/json'},body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(8000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!Array.isArray(data.iceServers))return err('Não foi possível preparar a ligação de voz/vídeo.',503);
 return out({iceServers:data.iceServers});
}
if(p==='/api/billing/google/verify'&&m==='POST')return handleGooglePlayBilling(req,env,me);

 if(p==='/api/calls/realtime-ticket'&&m==='POST'){
  const ticket=b64(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT INTO call_tickets(token_hash,user_id,call_id,expires_at) VALUES(?,?,NULL,?)').bind(await digest(ticket),me.id,new Date(Date.now()+60000).toISOString()).run();
  return out({ticket,expiresIn:60},201);
 }
 if(p==='/api/calls'&&m==='POST'){
  const b=await json(req,3000),conversationId=clean(b.conversationId,80),type=b.type==='video'?'video':'voice';
  const c=await env.DB.prepare('SELECT id,participant_a,participant_b FROM conversations WHERE id=? AND (participant_a=? OR participant_b=?)').bind(conversationId,me.id,me.id).first();
  if(!c)return err('Conversa não encontrada.',404);
  const calleeId=c.participant_a===me.id?c.participant_b:c.participant_a;
  const callee=await env.DB.prepare("SELECT id,name FROM users WHERE id=? AND status='active' AND deletion_requested_at IS NULL").bind(calleeId).first();
  if(!callee)return err('Este utilizador não está disponível.',404);
  const id=uid(),now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO calls(id,conversation_id,caller_id,callee_id,call_type,status,created_at) VALUES(?,?,?,?,?,'ringing',?)").bind(id,conversationId,me.id,calleeId,type,now).run();
  const data={callId:id,callType:type,conversationId,url:'/?call='+encodeURIComponent(id)};
  await notice(env,calleeId,'call',type==='video'?'Chamada de vídeo recebida':'Chamada de voz recebida',me.name+' está a ligar-te.',data);
  try{const room=env.CALL_ROOMS.getByName('user:'+calleeId);await room.fetch(new Request('https://call-room/broadcast',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'incoming-call',callId:id,callType:type,conversationId,callerId:me.id,callerName:me.name})}))}catch(e){console.error('call notify',e)}
  return out({ok:true,callId:id,callType:type,calleeName:callee.name},201);
 }
 const callMatch=p.match(/^\/api\/calls\/([\w-]+)(?:\/(answer|decline|end|ticket))?$/);
 if(callMatch){
  const id=callMatch[1],action=callMatch[2]||'';
  const call=await env.DB.prepare('SELECT id,conversation_id,caller_id,callee_id,call_type,status FROM calls WHERE id=? AND (caller_id=? OR callee_id=?)').bind(id,me.id,me.id).first();
  if(!call)return err('Chamada não encontrada.',404);
  if(m==='GET'&&!action){const other=await env.DB.prepare('SELECT name FROM users WHERE id=?').bind(call.caller_id===me.id?call.callee_id:call.caller_id).first();return out({call:{...call,otherName:other?.name||'Utilizador'}})}
  if(m==='POST'&&action==='ticket'){
   if(!['ringing','active'].includes(call.status))return err('Esta chamada já terminou.',409);
   const ticket=b64(crypto.getRandomValues(new Uint8Array(32)));
   await env.DB.prepare('INSERT INTO call_tickets(token_hash,user_id,call_id,expires_at) VALUES(?,?,?,?)').bind(await digest(ticket),me.id,id,new Date(Date.now()+60000).toISOString()).run();
   return out({ticket,expiresIn:60},201);
  }
  if(m==='POST'&&action==='answer'){
   if(me.id!==call.callee_id||call.status!=='ringing')return err('Esta chamada já não pode ser atendida.',409);
   await env.DB.prepare("UPDATE calls SET status='active',answered_at=? WHERE id=? AND status='ringing'").bind(new Date().toISOString(),id).run();
   await notice(env,call.caller_id,'call','Chamada atendida','A tua chamada foi atendida.',{callId:id,callType:call.call_type,url:'/?call='+id});
   return out({ok:true,status:'active'});
  }
  if(m==='POST'&&(action==='decline'||action==='end')){
   if(!['ringing','active'].includes(call.status))return out({ok:true,status:call.status});
   await env.DB.prepare('UPDATE calls SET status=?,ended_at=? WHERE id=?').bind(action==='decline'?'declined':'ended',new Date().toISOString(),id).run();
   const other=call.caller_id===me.id?call.callee_id:call.caller_id;
   await notice(env,other,'call',action==='decline'?'Chamada recusada':'Chamada terminada',action==='decline'?'A tua chamada foi recusada.':'A chamada terminou.',{callId:id,callType:call.call_type,url:'/'});
   try{const room=env.CALL_ROOMS.getByName(id);await room.fetch(new Request('https://call-room/broadcast',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'call-ended',by:me.id})}))}catch{}
   return out({ok:true,status:action==='decline'?'declined':'ended'});
  }
 }

// Correspondência de contactos: os números recebidos são usados apenas em memória e nunca são guardados.
if(p==='/api/contacts/match'&&m==='POST'){
 const rl=await limited(req,env,'contacts_match',8,3600);if(rl)return rl;
 const b=await json(req,120000),contacts=Array.isArray(b.contacts)?b.contacts.slice(0,500):[];
 if(!contacts.length)return out({users:[]});
 const normalizePhone=value=>{let n=String(value||'').replace(/[^0-9]/g,'');if(n.startsWith('00'))n=n.slice(2);if(n.length===9)n='244'+n;else if(n.length===10&&n.startsWith('0'))n='244'+n.slice(1);return n.length>=9&&n.length<=15?n:''};
 const wanted=new Map();for(const c of contacts){const phone=normalizePhone(c?.phone);if(phone&&!wanted.has(phone))wanted.set(phone,clean(c?.name,100))}
 const rows=await env.DB.prepare("SELECT u.id,u.name,p.phone,p.city,p.professions_json,CASE WHEN p.avatar_key IS NOT NULL THEN '/api/avatars/'||u.id ELSE NULL END avatar_url,(SELECT COUNT(*) FROM user_follows f WHERE f.followed_id=u.id) followers_count,EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=? AND f.followed_id=u.id) is_following FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.status='active' AND u.deletion_requested_at IS NULL AND p.public_profile=1 AND p.phone IS NOT NULL AND u.id<>? AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?) AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id=?)").bind(me.id,me.id,me.id,me.id).all();
 const matched=[];const seen=new Set();for(const row of rows.results||[]){const phone=normalizePhone(row.phone);if(phone&&wanted.has(phone)&&!seen.has(row.id)){seen.add(row.id);matched.push({...row,matched_contact_name:wanted.get(phone)})}}
 matched.sort((a,b)=>Number(b.is_following)-Number(a.is_following)||a.name.localeCompare(b.name));return out({users:matched.slice(0,100),checked:contacts.length});
}
// Rede profissional: diretório público, seguidores e perfis seguidos.
if(p==='/api/network'&&m==='GET'){
 const q=clean(u.searchParams.get('q'),80),profession=clean(u.searchParams.get('profession'),80);
 const rows=await env.DB.prepare("SELECT u.id,u.name,p.city,p.bio,p.professions_json,p.skills_json,CASE WHEN p.avatar_key IS NOT NULL THEN '/api/avatars/'||u.id ELSE NULL END avatar_url,(SELECT COUNT(*) FROM user_follows f WHERE f.followed_id=u.id) followers_count,(SELECT COUNT(*) FROM user_follows f WHERE f.follower_id=u.id) following_count,EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=? AND f.followed_id=u.id) is_following FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id<>? AND u.status='active' AND u.deletion_requested_at IS NULL AND p.public_profile=1 AND (?='' OR u.name LIKE '%'||?||'%' OR p.city LIKE '%'||?||'%' OR p.bio LIKE '%'||?||'%' OR p.professions_json LIKE '%'||?||'%' OR p.skills_json LIKE '%'||?||'%') AND (?='' OR p.professions_json LIKE '%'||?||'%') AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?) AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id=?) ORDER BY is_following DESC,followers_count DESC,u.name LIMIT 60").bind(me.id,me.id,q,q,q,q,q,q,profession,profession,me.id,me.id).all();
 return out({users:rows.results});
}
if(p==='/api/follows'&&m==='GET'){
 const rows=await env.DB.prepare("SELECT u.id,u.name,p.city,p.professions_json,CASE WHEN p.avatar_key IS NOT NULL THEN '/api/avatars/'||u.id ELSE NULL END avatar_url,(SELECT COUNT(*) FROM user_follows f WHERE f.followed_id=u.id) followers_count FROM user_follows mine JOIN users u ON u.id=mine.followed_id JOIN profiles p ON p.user_id=u.id WHERE mine.follower_id=? AND u.status='active' AND u.deletion_requested_at IS NULL ORDER BY mine.created_at DESC").bind(me.id).all();
 return out({users:rows.results});
}
if(p.startsWith('/api/follows/')&&(m==='POST'||m==='DELETE')){
 const target=decodeURIComponent(p.slice('/api/follows/'.length));if(!/^[\\w-]{1,80}$/.test(target)||target===me.id)return err('Perfil inválido para seguir.',400);
 const person=await env.DB.prepare("SELECT u.id,u.name FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=? AND u.status='active' AND u.deletion_requested_at IS NULL AND p.public_profile=1").bind(target).first();
 if(!person)return err('Este perfil não está disponível para seguir.',404);
 if(await env.DB.prepare('SELECT 1 ok FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').bind(me.id,target,target,me.id).first())return err('Não é possível criar esta ligação entre perfis.',403);
 if(m==='POST'){await env.DB.prepare('INSERT OR IGNORE INTO user_follows(follower_id,followed_id) VALUES(?,?)').bind(me.id,target).run();await notice(env,target,'follow','Novo seguidor',me.name+' começou a seguir o teu perfil.',{followerId:me.id});}
 else await env.DB.prepare('DELETE FROM user_follows WHERE follower_id=? AND followed_id=?').bind(me.id,target).run();
 const count=await env.DB.prepare('SELECT COUNT(*) n FROM user_follows WHERE followed_id=?').bind(target).first();
 return out({ok:true,following:m==='POST',followersCount:Number(count?.n||0)},m==='POST'?201:200);
}
if(p==='/api/onboarding/complete'&&m==='POST'){const now=new Date().toISOString();await env.DB.prepare('UPDATE users SET onboarding_completed_at=COALESCE(onboarding_completed_at,?) WHERE id=?').bind(now,me.id).run();return out({ok:true,completedAt:now})}
if(p==='/api/usage'&&m==='GET'){const plusActive=await plusIsActive(env,me.id),dayStart=angolaPeriodStart('day'),monthStart=angolaPeriodStart('month');const [a,l]=await Promise.all([env.DB.prepare('SELECT COUNT(*) n FROM proposals WHERE sender_id=? AND created_at>=?').bind(me.id,dayStart).first(),env.DB.prepare('SELECT COUNT(*) n FROM listings WHERE owner_id=? AND created_at>=?').bind(me.id,monthStart).first()]);return out({plusActive,applicationsToday:Number(a?.n||0),postsThisMonth:Number(l?.n||0),freeApplicationsPerDay:5,freePostsPerMonth:10})}
 if(p==='/api/identity/status'&&m==='GET'){
  const [v,user]=await Promise.all([
   env.DB.prepare('SELECT session_id,status,session_url,created_at,updated_at FROM identity_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1').bind(me.id).first(),
   env.DB.prepare('SELECT identity_verified_at FROM users WHERE id=?').bind(me.id).first()
  ]);
  const active=v&&['Not Started','In Progress','Awaiting User','In Review','Resubmitted'].includes(v.status);
  return out({verified:!!user?.identity_verified_at,verifiedAt:user?.identity_verified_at||null,status:v?.status||'Not Started',createdAt:v?.created_at||null,updatedAt:v?.updated_at||null,sessionUrl:active?v.session_url||null:null,canStart:!user?.identity_verified_at&&!active});
 }
 if(p==='/api/identity/start'&&m==='POST'){
  const rl=await limited(req,env,'identity_start',3,3600);if(rl)return rl;
  const b=await json(req,3000);
  if(b.consent!==true)return err('É necessário aceitar o consentimento antes de continuar.',403);
  if(!env.DIDIT_API_KEY||!env.DIDIT_WORKFLOW_ID)return err('A integração de identidade ainda não está configurada no servidor.',503);
  const existing=await env.DB.prepare('SELECT session_id,status,session_url FROM identity_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1').bind(me.id).first();
  if(existing&&['Not Started','In Progress','Awaiting User','In Review','Resubmitted'].includes(existing.status))return out({sessionId:existing.session_id,url:existing.session_url,status:existing.status});
  const response=await fetch('https://verification.didit.me/v3/session/',{method:'POST',headers:{'x-api-key':env.DIDIT_API_KEY,'content-type':'application/json'},body:JSON.stringify({workflow_id:env.DIDIT_WORKFLOW_ID,vendor_data:me.id,callback:'https://aquipay.isabstudio.dev/?identity=return'})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){console.error('Didit session creation failed',response.status);return err('Não foi possível iniciar a verificação. Tenta novamente mais tarde.',502)}
  const sessionId=clean(data.session_id||data.id,120),url=clean(data.url||data.session_url,2000);
  let host='';try{const parsed=new URL(url);if(parsed.protocol==='https:')host=parsed.hostname}catch{}
  if(!sessionId||!host||(host!=='verify.didit.me'&&!host.endsWith('.didit.me')))return err('A Didit devolveu uma sessão inválida.',502);
  const now=new Date().toISOString();
  await env.DB.prepare('INSERT INTO identity_verifications(id,user_id,session_id,status,session_url,created_at,updated_at,consent_at,consent_version) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid(),me.id,sessionId,'In Progress',url,now,now,now,'2026-11-23-v1').run();
  return out({sessionId,url,status:'In Progress'},201);
 }

 if(p==='/api/me/deletion'&&m==='GET')return out({deletionRequestedAt:me.deletion_requested_at||null,deletionDueAt:me.deletion_due_at||null});
 if(p==='/api/me/deletion/cancel'&&m==='POST'){await env.DB.prepare('UPDATE users SET deletion_requested_at=NULL,deletion_due_at=NULL WHERE id=? AND status=\'active\'').bind(me.id).run();return out({ok:true})}
 if(p==='/api/security/status'&&m==='GET'){
  const [u,sessions]=await Promise.all([env.DB.prepare('SELECT totp_enabled,totp_recovery_hashes FROM users WHERE id=?').bind(me.id).first(),env.DB.prepare('SELECT token_hash,created_at,expires_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC').bind(me.id,new Date().toISOString()).all()]);
  let recovery=[];try{recovery=JSON.parse(u?.totp_recovery_hashes||'[]')}catch{}
  const currentHash=await digest((req.headers.get('authorization')||'').slice(7));
  return out({twoFactorEnabled:!!u?.totp_enabled,recoveryCodesRemaining:recovery.length,sessions:sessions.results.map(x=>({id:x.token_hash.slice(0,32),current:x.token_hash===currentHash,createdAt:x.created_at,expiresAt:x.expires_at}))});
 }
 if(p==='/api/security/totp/setup'&&m==='POST'){
  const rl=await limited(req,env,'totp_setup',5,3600);if(rl)return rl;
  try{const b=await json(req,10000),u=await env.DB.prepare('SELECT email,password_hash,password_salt,google_sub,totp_enabled FROM users WHERE id=?').bind(me.id).first();if(!env.TOTP_ENCRYPTION_KEY)return err('A proteção criptográfica do autenticador ainda não está configurada no servidor.',503);if(u?.totp_enabled)return err('A verificação em dois passos já está ativa.',409);if(u?.google_sub){let claims;try{claims=await googleClaims(clean(b.googleCredential,8000),env.GOOGLE_CLIENT_ID)}catch{return err('Confirma novamente a tua conta Google.',403)}if(claims.sub!==u.google_sub||String(claims.email||'').toLowerCase()!==u.email)return err('A confirmação Google não corresponde a esta conta.',403)}else{const currentPassword=typeof b.currentPassword==='string'?b.currentPassword:'';if(!currentPassword||await passHash(currentPassword,u.password_salt)!==u.password_hash)return err('Palavra-passe atual incorreta.',403)}const secret=base32Encode(crypto.getRandomValues(new Uint8Array(20))),encrypted=await encryptTotpSecret(secret,env);await env.DB.prepare('UPDATE users SET totp_pending_secret=?,totp_pending_expires=? WHERE id=?').bind(encrypted,new Date(Date.now()+10*60000).toISOString(),me.id).run();const label=encodeURIComponent('AquiPay:'+u.email),issuer=encodeURIComponent('AquiPay');return out({secret,otpauthUri:'otpauth://totp/'+label+'?secret='+secret+'&issuer='+issuer+'&algorithm=SHA1&digits=6&period=30',expiresIn:600})}catch(e){console.error('TOTP setup',e);return err('Não foi possível preparar o autenticador.',503)}
 }
 if(p==='/api/security/totp/enable'&&m==='POST'){
  const rl=await limited(req,env,'totp_enable',8,900);if(rl)return rl;
  const b=await json(req,2000),u=await env.DB.prepare('SELECT totp_pending_secret,totp_pending_expires,totp_enabled FROM users WHERE id=?').bind(me.id).first();
  if(!u?.totp_pending_secret||u.totp_pending_expires<new Date().toISOString())return err('A configuração expirou. Começa novamente.',410);
  if(u.totp_enabled)return err('A verificação em dois passos já está ativa.',409);
  let secret;try{secret=await decryptTotpSecret(u.totp_pending_secret,env)}catch{return err('Não foi possível validar a configuração.',503)}
  if(!await verifyTotp(secret,b.code))return err('Código incorreto. Confere o relógio e tenta novamente.',401);
  const codes=makeRecoveryCodes(),hashes=await Promise.all(codes.map(x=>digest(x.replace(/-/g,''))));
  await env.DB.prepare('UPDATE users SET totp_secret=totp_pending_secret,totp_pending_secret=NULL,totp_pending_expires=NULL,totp_enabled=1,totp_recovery_hashes=? WHERE id=?').bind(JSON.stringify(hashes),me.id).run();
  return out({ok:true,recoveryCodes:codes});
 }
 if(p==='/api/security/totp/disable'&&m==='POST'){
  const rl=await limited(req,env,'totp_disable',5,900);if(rl)return rl;
  const b=await json(req,2000),u=await env.DB.prepare('SELECT id,totp_enabled,totp_secret,totp_recovery_hashes FROM users WHERE id=?').bind(me.id).first();
  if(!u?.totp_enabled)return err('A verificação em dois passos não está ativa.',409);
  const checked=await verifyAccountCode(u,b.code,env);if(!checked.ok)return err('Código de segurança incorreto.',403);
  const token=(req.headers.get('authorization')||'').slice(7),hash=await digest(token);
  await env.DB.batch([env.DB.prepare('UPDATE users SET totp_secret=NULL,totp_pending_secret=NULL,totp_pending_expires=NULL,totp_enabled=0,totp_recovery_hashes=? WHERE id=?').bind('[]',me.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(me.id,hash)]);
  return out({ok:true});
 }
 if(p==='/api/security/totp/recovery/regenerate'&&m==='POST'){
  const rl=await limited(req,env,'totp_recovery',5,900);if(rl)return rl;
  const b=await json(req,2000),u=await env.DB.prepare('SELECT id,totp_enabled,totp_secret FROM users WHERE id=?').bind(me.id).first();
  if(!u?.totp_enabled)return err('Ativa primeiro a verificação em dois passos.',409);
  if(!await verifyTotp(await decryptTotpSecret(u.totp_secret,env),b.code))return err('Código incorreto.',403);
  const codes=makeRecoveryCodes(),hashes=await Promise.all(codes.map(x=>digest(x.replace(/-/g,''))));
  await env.DB.prepare('UPDATE users SET totp_recovery_hashes=? WHERE id=?').bind(JSON.stringify(hashes),me.id).run();
  return out({ok:true,recoveryCodes:codes});
 }
 if(p==='/api/security/sessions'&&m==='GET'){
  const currentHash=await digest((req.headers.get('authorization')||'').slice(7)),r=await env.DB.prepare('SELECT token_hash,created_at,expires_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC').bind(me.id,new Date().toISOString()).all();
  return out({sessions:r.results.map(x=>({id:x.token_hash.slice(0,32),current:x.token_hash===currentHash,createdAt:x.created_at,expiresAt:x.expires_at}))});
 }
 if(p==='/api/security/sessions/revoke-others'&&m==='POST'){
  const hash=await digest((req.headers.get('authorization')||'').slice(7));await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(me.id,hash).run();return out({ok:true});
 }
 const sessionMatch=p.match(/^\/api\/security\/sessions\/([A-Za-z0-9_-]{32})$/);
 if(sessionMatch&&m==='DELETE'){
  const target=await env.DB.prepare('SELECT token_hash FROM sessions WHERE user_id=? AND substr(token_hash,1,32)=?').bind(me.id,sessionMatch[1]).first();
  if(!target)return err('Sessão não encontrada.',404);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash=? AND user_id=?').bind(target.token_hash,me.id).run();return out({ok:true});
 }
 if(p==='/api/push/subscribe'&&m==='POST')return pushSubscribe(req,env,me);
 if(p==='/api/push/fcm/register'&&m==='POST')return registerFcmToken(req,env,me);
 if(p==='/api/push/fcm/unregister'&&m==='POST'){const b=await json(req,3000),token=clean(b.token,4096);await env.DB.prepare('DELETE FROM fcm_tokens WHERE token=? AND user_id=?').bind(token,me.id).run();return out({ok:true})}
 if(p==='/api/push/unsubscribe'&&m==='POST'){const b=await json(req,2000);await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').bind(clean(b.endpoint,600),me.id).run();return out({ok:true})}
 if(p==='/api/auth/logout'&&m==='POST'){const t=(req.headers.get('authorization')||'').slice(7);await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(t)).run();return out({ok:true})}
 if(p==='/api/auth/password'&&m==='POST'){const rl=await limited(req,env,'pwchange',6,900);if(rl)return rl;const b=await json(req,2000),cur=typeof b.currentPassword==='string'?b.currentPassword:'',nw=typeof b.newPassword==='string'?b.newPassword:'';const x=await env.DB.prepare('SELECT password_hash,password_salt,google_sub,totp_enabled,totp_secret,totp_recovery_hashes FROM users WHERE id=?').bind(me.id).first();if(!x)return err('Conta indisponível.',404);if(x.google_sub)return err('Esta conta usa o Google para entrar.');if(x.totp_enabled){const checked=await verifyAccountCode(x,b.code,env);if(!checked.ok)return err('Código do autenticador obrigatório ou incorreto.',403)}if(nw.length<10||nw.length>200)return err('A palavra-passe deve ter pelo menos 10 caracteres.');if(await passHash(cur,x.password_salt)!==x.password_hash)return err('Palavra-passe atual incorreta.',403);if(nw===cur)return err('A nova palavra-passe tem de ser diferente da atual.');const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passHash(nw,salt),t=(req.headers.get('authorization')||'').slice(7);await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').bind(hash,salt,me.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(me.id,await digest(t))]);return out({ok:true})}
 if(p==='/api/me'&&m==='DELETE'){const rl=await limited(req,env,'delacct',5,3600);if(rl)return rl;const b=await json(req,2000),x=await env.DB.prepare('SELECT password_hash,password_salt,google_sub,email,deletion_requested_at,deletion_due_at,totp_enabled,totp_secret,totp_recovery_hashes FROM users WHERE id=?').bind(me.id).first();if(!x)return err('Conta indisponível.',404);if(x.google_sub){if(String(b.confirmEmail||'').trim().toLowerCase()!==String(x.email).toLowerCase())return err('Confirmação incorreta.',403)}else if(typeof b.password!=='string'||await passHash(b.password,x.password_salt)!==x.password_hash)return err('Palavra-passe atual incorreta.',403);if(x.totp_enabled){const checked=await verifyAccountCode(x,b.code,env);if(!checked.ok)return err('Código do autenticador obrigatório ou incorreto.',403)}if(x.deletion_requested_at)return out({ok:true,deletionRequestedAt:x.deletion_requested_at,deletionDueAt:x.deletion_due_at});const now=new Date(),requested=now.toISOString(),due=new Date(now.getTime()+30*86400000).toISOString();await env.DB.prepare('UPDATE users SET deletion_requested_at=?,deletion_due_at=? WHERE id=?').bind(requested,due,me.id).run();return out({ok:true,deletionRequestedAt:requested,deletionDueAt:due})}
 if(p==='/api/reports'&&m==='POST'){const rl=await limited(req,env,'report',20,3600);if(rl)return rl;const b=await json(req,4000),type=['user','listing'].includes(b.targetType)?b.targetType:'',tid=clean(b.targetId,80),reason=['spam','fraud','abuse','illegal','fake','other'].includes(b.reason)?b.reason:'',details=clean(b.details,1000);if(!type||!tid||!reason||(type==='user'&&tid===me.id))return err('Denúncia inválida.');const ok=type==='user'?await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active' AND deletion_requested_at IS NULL").bind(tid).first():await env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(tid).first();if(!ok)return err('Denúncia inválida.');const r=await env.DB.prepare('INSERT OR IGNORE INTO reports(id,reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?,?)').bind(uid(),me.id,type,tid,reason,details).run();return out({ok:true,duplicate:!(r.meta&&r.meta.changes>0)},201)}
 if(p==='/api/blocks'&&m==='GET'){const r=await env.DB.prepare('SELECT u.id,u.name FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC').bind(me.id).all();return out({blocks:r.results})}
 if(p==='/api/blocks'&&m==='POST'){const b=await json(req,1000),tid=clean(b.userId,80);if(!tid||tid===me.id)return err('Utilizador não encontrado.',404);const t=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active' AND deletion_requested_at IS NULL").bind(tid).first();if(!t)return err('Utilizador não encontrado.',404);await env.DB.prepare('INSERT OR IGNORE INTO blocks(blocker_id,blocked_id) VALUES(?,?)').bind(me.id,tid).run();return out({ok:true},201)}
 const blk=p.match(/^\/api\/blocks\/([\w-]+)$/);if(blk&&m==='DELETE'){await env.DB.prepare('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?').bind(me.id,blk[1]).run();return out({ok:true})}
 if(p==='/api/me'&&m==='GET'){const [profile,wallet,earnings]=await Promise.all([env.DB.prepare('SELECT * FROM profiles WHERE user_id=?').bind(me.id).first(),env.DB.prepare('SELECT available_coins,pending_coins FROM wallets WHERE user_id=?').bind(me.id).first(),env.DB.prepare("SELECT COALESCE(SUM(COALESCE(p.price_minor,l.price_minor,0)),0) total_minor,COUNT(*) completed_count FROM proposals p JOIN listings l ON l.id=p.listing_id WHERE p.status='completed' AND COALESCE(p.price_minor,l.price_minor,0)>0 AND ((l.kind='job' AND p.sender_id=?) OR (l.kind IN ('service','product') AND p.receiver_id=?))").bind(me.id,me.id).first()]);return out({user:me,profile,wallet,earnings:{totalMinor:Number(earnings?.total_minor||0),completedCount:Number(earnings?.completed_count||0),currency:'AOA'}})}
 if(p==='/api/profile'&&m==='PATCH'){const b=await json(req),arr=(v,n)=>JSON.stringify(Array.isArray(v)?v.slice(0,n):[]);await env.DB.batch([env.DB.prepare('UPDATE users SET name=? WHERE id=?').bind(clean(b.name,80)||me.name,me.id),env.DB.prepare('UPDATE profiles SET city=?,phone=?,bio=?,professions_json=?,skills_json=?,portfolio_json=?,experience_json=?,education_json=?,public_profile=?,updated_at=? WHERE user_id=?').bind(clean(b.city,100),clean(b.phone,40),clean(b.bio,2000),arr(b.professions,20),arr(b.skills,40),arr(b.portfolio,30),arr(b.experience,30),arr(b.education,30),b.publicProfile===false?0:1,new Date().toISOString(),me.id)]);return out({ok:true})}
 if(p==='/api/profile/avatar'&&m==='POST'){if(!env.MEDIA)return err('Armazenamento de imagens indisponível.',503);const form=await req.formData(),file=form.get('file');if(!(file instanceof File)||file.size<1||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return err('Escolhe uma imagem JPG, PNG ou WEBP até 5 MB.');const id=uid(),key=`avatars/${me.id}/${id}`;await env.MEDIA.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:'public, max-age=3600'}});const old=await env.DB.prepare('SELECT avatar_key FROM profiles WHERE user_id=?').bind(me.id).first();await env.DB.prepare('UPDATE profiles SET avatar_key=?,updated_at=? WHERE user_id=?').bind(key,new Date().toISOString(),me.id).run();if(old?.avatar_key)await env.MEDIA.delete(old.avatar_key).catch(()=>{});return out({ok:true,url:'/api/avatars/'+me.id},201)}
 if(p==='/api/ratings'&&m==='POST'){const b=await json(req),target=clean(b.targetUserId,80),stars=Number(b.stars),comment=clean(b.comment,800);if(!target||target===me.id||!Number.isInteger(stars)||stars<1||stars>5)return err('Classificação inválida.');const targetExists=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active' AND deletion_requested_at IS NULL").bind(target).first();if(!targetExists)return err('Utilizador não encontrado.',404);const interaction=await env.DB.prepare("SELECT 1 ok FROM proposals p WHERE p.status IN ('accepted','completed') AND ((p.sender_id=? AND p.receiver_id=?) OR (p.sender_id=? AND p.receiver_id=?)) LIMIT 1").bind(me.id,target,target,me.id).first();if(!interaction)return err('Só podes classificar alguém com quem tiveste uma proposta aceite ou concluída.',403);try{await env.DB.prepare('INSERT INTO profile_ratings(id,target_user_id,reviewer_user_id,stars,comment) VALUES(?,?,?,?,?)').bind(uid(),target,me.id,stars,comment).run()}catch{return err('Já classificaste este perfil ou a avaliação não pôde ser guardada.',409)}await notice(env,target,'rating','Nova classificação',`${me.name} avaliou o teu perfil com ${stars} estrela(s).`,{reviewerId:me.id});return out({ok:true},201)}
 // Upload privado de CV, certificados, portfólio e vídeo de apresentação.
 if(p==='/api/documents'&&m==='POST'){if(!env.MEDIA)return err('Armazenamento de ficheiros indisponível.',503);const ct=req.headers.get('content-type')||'';if(!ct.includes('multipart/form-data'))return err('Envia o ficheiro em multipart/form-data.');const form=await req.formData(),file=form.get('file'),category=clean(form.get('category'),30);const allowed=['cv','certificate','portfolio','experience','education','intro_video'];if(!(file instanceof File)||!allowed.includes(category))return err('Ficheiro ou categoria inválidos.');const video=category==='intro_video',isPublic=form.get('isPublic')==='true',limit=video?20*1024*1024:10*1024*1024;if(file.size<1||file.size>limit)return err(video?'O vídeo deve ter no máximo 20 MB.':'O documento deve ter no máximo 10 MB.');const types=video?['video/mp4','video/webm','video/quicktime']:['application/pdf','image/jpeg','image/png','image/webp'];if(!types.includes(file.type))return err('Formato não permitido. Usa PDF, JPG, PNG, WEBP ou MP4/WEBM para vídeo.');const bytes=await file.arrayBuffer(),head=new Uint8Array(bytes.slice(0,16));const hex=[...head].map(x=>x.toString(16).padStart(2,'0')).join('');const valid=file.type==='application/pdf'?hex.startsWith('25504446'):file.type==='image/jpeg'?hex.startsWith('ffd8ff'):file.type==='image/png'?hex.startsWith('89504e470d0a1a0a'):file.type==='image/webp'?String.fromCharCode(...head.slice(8,12))==='WEBP':file.type==='video/mp4'?String.fromCharCode(...head.slice(4,8))==='ftyp':file.type==='video/webm'?hex.startsWith('1a45dfa3'):file.type==='video/quicktime'?String.fromCharCode(...head.slice(4,8))==='ftyp':false;if(!valid)return err('O conteúdo do ficheiro não corresponde ao formato indicado.');const id=uid(),key=`private/${me.id}/${id}`,name=clean(file.name.replace(/[\\/\\\\]/g,'_'),180)||'documento';await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:file.type,cacheControl:'private, no-store'},customMetadata:{ownerId:me.id,category,originalName:name}});try{await env.DB.prepare('INSERT INTO documents(id,user_id,category,original_name,content_type,object_key,size_bytes,is_public) VALUES(?,?,?,?,?,?,?,?)').bind(id,me.id,category,name,file.type,key,file.size,isPublic?1:0).run()}catch(e){await env.MEDIA.delete(key);throw e}return out({id,category,name,size:file.size,isPublic,createdAt:new Date().toISOString()},201)}
 if(p==='/api/documents'&&m==='GET'){const r=await env.DB.prepare('SELECT id,category,original_name,content_type,size_bytes,is_public,created_at FROM documents WHERE user_id=? ORDER BY created_at DESC').bind(me.id).all();return out({documents:r.results})}
 const doc=p.match(/^\/api\/documents\/([\w-]+)$/);if(doc){const d=await env.DB.prepare('SELECT id,user_id,original_name,content_type,object_key,size_bytes FROM documents WHERE id=? AND user_id=?').bind(doc[1],me.id).first();if(!d)return err('Documento não encontrado.',404);if(m==='DELETE'){await env.MEDIA.delete(d.object_key);await env.DB.prepare('DELETE FROM documents WHERE id=? AND user_id=?').bind(d.id,me.id).run();return out({ok:true})}if(m==='GET'){const obj=await env.MEDIA.get(d.object_key);if(!obj)return err('Ficheiro não encontrado.',404);return new Response(obj.body,{headers:{'content-type':d.content_type,'content-length':String(d.size_bytes),'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.original_name)}`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}})}}
 if(p==='/api/listings'&&m==='GET'){const k=u.searchParams.get('kind'),q=clean(u.searchParams.get('q'),100),kind=['job','product','service'].includes(k)?k:null,c=clean(u.searchParams.get('country'),2).toUpperCase(),country=/^[A-Z]{2}$/.test(c)?c:null;const r=await env.DB.prepare("SELECT l.id,l.owner_id,l.kind,l.title,l.description,l.price_minor,l.currency,l.city,l.country,l.media_json,l.created_at,u.name owner_name,CASE WHEN p.avatar_key IS NOT NULL THEN '/api/avatars/'||u.id ELSE NULL END owner_avatar_url,(SELECT ROUND(AVG(stars),1) FROM profile_ratings pr WHERE pr.target_user_id=u.id) owner_rating_avg,(SELECT COUNT(*) FROM profile_ratings pr WHERE pr.target_user_id=u.id) owner_rating_count,(SELECT COUNT(*) FROM proposals ap WHERE ap.listing_id=l.id AND ap.status='accepted') accepted_proposals_count FROM listings l JOIN users u ON u.id=l.owner_id JOIN profiles p ON p.user_id=u.id WHERE l.status='active' AND u.status='active' AND u.deletion_requested_at IS NULL AND (? IS NULL OR l.kind=?) AND (? IS NULL OR l.country=?) AND (?='' OR l.title LIKE '%'||?||'%' OR l.description LIKE '%'||?||'%' OR l.city LIKE '%'||?||'%') ORDER BY l.created_at DESC LIMIT 100").bind(kind,kind,country,country,q,q,q,q).all();return out({listings:r.results})}
 if(p==='/api/listings'&&m==='POST'){const b=await json(req,20000),kind=b.kind,title=clean(b.title,120),desc=clean(b.description,5000),price=b.priceMinor==null?null:Number(b.priceMinor);if(!['job','product','service'].includes(kind)||title.length<3||desc.length<5||(price!==null&&(!Number.isSafeInteger(price)||price<0)))return err('Dados do anúncio inválidos.');const id=uid(),requestedCountry=clean(b.country,2).toUpperCase(),country=/^[A-Z]{2}$/.test(requestedCountry)?requestedCountry:(clean(req.cf?.country,2).toUpperCase()||'AO'),plusActive=await plusIsActive(env,me.id),monthStart=angolaPeriodStart('month');let inserted;if(plusActive){inserted=await env.DB.prepare('INSERT INTO listings(id,owner_id,kind,title,description,price_minor,currency,city,country) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id').bind(id,me.id,kind,title,desc,price,'AOA',clean(b.city,100),country).first()}else{inserted=await env.DB.prepare('INSERT INTO listings(id,owner_id,kind,title,description,price_minor,currency,city,country) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM listings WHERE owner_id=? AND created_at>=?)<10 RETURNING id').bind(id,me.id,kind,title,desc,price,'AOA',clean(b.city,100),country,me.id,monthStart).first()}if(!inserted)return err('Atingiste os 10 anúncios gratuitos deste mês. Ativa o Plus para publicar sem limite.',429);if(ctx&&typeof ctx.waitUntil==='function')ctx.waitUntil(broadcastPost(env,me.id,title,kind));const usage=await env.DB.prepare('SELECT COUNT(*) n FROM listings WHERE owner_id=? AND created_at>=?').bind(me.id,monthStart).first();return out({id,ok:true,country,plusActive,postsThisMonth:Number(usage?.n||0)},201)}
 const listingMediaUpload=p.match(/^\/api\/listings\/([\w-]+)\/media$/);if(listingMediaUpload&&m==='POST'){if(!env.MEDIA)return err('Armazenamento de imagens indisponível.',503);const listing=await env.DB.prepare('SELECT id,media_json FROM listings WHERE id=? AND owner_id=? AND status=\'active\'').bind(listingMediaUpload[1],me.id).first();if(!listing)return err('Anúncio não encontrado.',404);const form=await req.formData(),files=form.getAll('files').filter(x=>x instanceof File);if(!files.length||files.length>4)return err('Envia entre 1 e 4 fotografias.');let media=[];try{media=JSON.parse(listing.media_json||'[]')}catch{}if(media.length+files.length>4)return err('O anúncio permite até 4 fotografias.');for(const file of files){if(file.size<1||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return err('Cada fotografia deve ser JPG, PNG ou WEBP até 5 MB.');const id=uid(),key=`listings/${listing.id}/${id}`;await env.MEDIA.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:'public, max-age=86400'}});media.push({id,key,type:file.type})}await env.DB.prepare('UPDATE listings SET media_json=?,updated_at=? WHERE id=? AND owner_id=?').bind(JSON.stringify(media),new Date().toISOString(),listing.id,me.id).run();return out({ok:true,count:media.length},201)}
 const listingDelete=p.match(/^\/api\/listings\/([\w-]+)$/);if(listingDelete&&m==='DELETE'){const item=await env.DB.prepare('SELECT id FROM listings WHERE id=? AND owner_id=?').bind(listingDelete[1],me.id).first();if(!item)return err('Anúncio não encontrado.',404);const now=new Date().toISOString();await env.DB.batch([env.DB.prepare("UPDATE listings SET status='removed',updated_at=? WHERE id=? AND owner_id=?").bind(now,item.id,me.id),env.DB.prepare("UPDATE proposals SET status='cancelled',updated_at=? WHERE listing_id=? AND status IN ('sent','accepted')").bind(now,item.id)]);return out({ok:true})}
 if(p==='/api/proposals'&&m==='POST'){const b=await json(req,12000),listingId=clean(b.listingId,80),message=clean(b.message,4000),listing=await env.DB.prepare("SELECT l.id,l.owner_id,l.title FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=? AND l.status='active' AND u.status='active' AND u.deletion_requested_at IS NULL").bind(listingId).first(),price=b.priceMinor==null?null:Number(b.priceMinor);if(!listing||listing.owner_id===me.id||message.length<10||(price!==null&&(!Number.isSafeInteger(price)||price<0)))return err('Proposta inválida.');if(await env.DB.prepare("SELECT 1 x FROM proposals WHERE listing_id=? AND status='accepted' LIMIT 1").bind(listingId).first())return err('Este anúncio já está negociado e não aceita novas propostas.',409);if(await env.DB.prepare('SELECT 1 x FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').bind(me.id,listing.owner_id,listing.owner_id,me.id).first())return err('Não é possível enviar propostas a este utilizador.',403);const plusActive=await plusIsActive(env,me.id),dayStart=angolaPeriodStart('day'),proposalId=uid(),conversationId=uid();let inserted;if(plusActive){inserted=await env.DB.prepare('INSERT INTO proposals(id,listing_id,sender_id,receiver_id,message,price_minor,delivery_days) VALUES(?,?,?,?,?,?,?) RETURNING id').bind(proposalId,listingId,me.id,listing.owner_id,message,price,Number.isInteger(b.deliveryDays)?Math.max(1,Math.min(365,b.deliveryDays)):null).first()}else{inserted=await env.DB.prepare('INSERT INTO proposals(id,listing_id,sender_id,receiver_id,message,price_minor,delivery_days) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM proposals WHERE sender_id=? AND created_at>=?)<5 RETURNING id').bind(proposalId,listingId,me.id,listing.owner_id,message,price,Number.isInteger(b.deliveryDays)?Math.max(1,Math.min(365,b.deliveryDays)):null,me.id,dayStart).first()}if(!inserted)return err('Atingiste as 5 candidaturas gratuitas de hoje. Volta amanhã ou ativa o Plus para candidaturas ilimitadas.',429);await env.DB.prepare('INSERT INTO conversations(id,proposal_id,participant_a,participant_b) VALUES(?,?,?,?)').bind(conversationId,proposalId,me.id,listing.owner_id).run();await notice(env,listing.owner_id,'proposal','Nova proposta',`${me.name} enviou uma proposta para «${listing.title}».`,{proposalId,conversationId,url:'/?conversation='+encodeURIComponent(conversationId)});const usage=await env.DB.prepare('SELECT COUNT(*) n FROM proposals WHERE sender_id=? AND created_at>=?').bind(me.id,dayStart).first();return out({proposalId,conversationId,ok:true,plusActive,applicationsToday:Number(usage?.n||0)},201)}
 const pr=p.match(/^\/api\/proposals\/([\w-]+)$/);if(pr&&m==='PATCH'){const b=await json(req),status=b.status,proposal=await env.DB.prepare('SELECT p.id,p.listing_id,p.sender_id,p.receiver_id,p.status,c.id conversation_id,l.kind listing_kind,l.owner_id listing_owner_id FROM proposals p JOIN listings l ON l.id=p.listing_id LEFT JOIN conversations c ON c.proposal_id=p.id WHERE p.id=?').bind(pr[1]).first();if(!proposal)return err('Proposta não encontrada.',404);if(!['accepted','rejected','completed'].includes(status))return err('Estado inválido.');const receiver=proposal.receiver_id===me.id,sender=proposal.sender_id===me.id;if(status==='accepted'||status==='rejected'){if(!receiver||proposal.status!=='sent')return err('Só quem publicou o anúncio pode aceitar ou recusar uma proposta enviada.',403)}else{const clientId=proposal.listing_kind==='job'?proposal.listing_owner_id:proposal.sender_id;if(!(receiver||sender)||me.id!==clientId||proposal.status!=='accepted')return err('Só o cliente pode confirmar a conclusão de um trabalho ou negócio aceite.',403)}await env.DB.prepare('UPDATE proposals SET status=?,updated_at=? WHERE id=?').bind(status,new Date().toISOString(),proposal.id).run();const recipient=receiver?proposal.sender_id:proposal.receiver_id;await notice(env,recipient,'proposal_status','Atualização da proposta',status==='accepted'?'A tua proposta foi aceite.':status==='rejected'?'A tua proposta foi recusada.':'A proposta foi marcada como concluída.',{proposalId:proposal.id,status,conversationId:proposal.conversation_id,url:proposal.conversation_id?'/?conversation='+encodeURIComponent(proposal.conversation_id):'/' });return out({ok:true,status})}
 const conversationRead=p.match(/^\/api\/conversations\/([\w-]+)\/(read|unread)$/);if(conversationRead&&m==='POST'){const cid=conversationRead[1],mode=conversationRead[2],conversation=await env.DB.prepare('SELECT id FROM conversations WHERE id=? AND (participant_a=? OR participant_b=?)').bind(cid,me.id,me.id).first();if(!conversation)return err('Conversa não encontrada.',404);if(mode==='read'){await env.DB.prepare('UPDATE messages SET read_at=? WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL').bind(new Date().toISOString(),cid,me.id).run()}else{const latest=await env.DB.prepare('SELECT id FROM messages WHERE conversation_id=? AND sender_id<>? ORDER BY created_at DESC LIMIT 1').bind(cid,me.id).first();if(!latest)return err('Não há mensagens recebidas para marcar como não lida.',409);await env.DB.prepare('UPDATE messages SET read_at=NULL WHERE id=? AND conversation_id=?').bind(latest.id,cid).run()}return out({ok:true})}
 if(p==='/api/conversations'&&m==='GET'){const r=await env.DB.prepare('SELECT c.id,c.proposal_id,c.created_at,CASE WHEN c.participant_a=? THEN c.participant_b ELSE c.participant_a END other_user_id,u.name other_user_name,(SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message,(SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) unread_count FROM conversations c JOIN users u ON u.id=CASE WHEN c.participant_a=? THEN c.participant_b ELSE c.participant_a END WHERE (c.participant_a=? OR c.participant_b=?) AND u.status=\'active\' AND u.deletion_requested_at IS NULL ORDER BY c.created_at DESC').bind(me.id,me.id,me.id,me.id,me.id).all();return out({conversations:r.results})}
 const cm=p.match(/^\/api\/conversations\/([\w-]+)\/messages$/);if(cm){const cid=cm[1],c=await env.DB.prepare("SELECT id,participant_a,participant_b FROM conversations WHERE id=? AND (participant_a=? OR participant_b=?) AND EXISTS (SELECT 1 FROM users u WHERE u.id=CASE WHEN participant_a=? THEN participant_b ELSE participant_a END AND u.status='active' AND u.deletion_requested_at IS NULL)").bind(cid,me.id,me.id,me.id).first();if(!c)return err('Conversa não encontrada.',404);if(m==='GET'){await env.DB.prepare('UPDATE messages SET read_at=? WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL').bind(new Date().toISOString(),cid,me.id).run();const r=await env.DB.prepare('SELECT id,sender_id,body,read_at,created_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT 200').bind(cid).all();return out({messages:r.results})}if(m==='POST'){const b=await json(req),body=clean(b.body,4000);if(!body)return err('Escreve uma mensagem.');const recipient=c.participant_a===me.id?c.participant_b:c.participant_a,id=uid();await env.DB.prepare('INSERT INTO messages(id,conversation_id,sender_id,body) VALUES(?,?,?,?)').bind(id,cid,me.id,body).run();await notice(env,recipient,'message','Nova mensagem',`${me.name} enviou-te uma mensagem.`,{conversationId:cid,url:'/?conversation='+encodeURIComponent(cid)});return out({id,ok:true},201)}}
 if(p==='/api/notifications'&&m==='GET'){const [r,n]=await Promise.all([env.DB.prepare('SELECT id,kind,title,body,data_json,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(me.id).all(),env.DB.prepare('SELECT COUNT(*) count FROM notifications WHERE user_id=? AND read_at IS NULL').bind(me.id).first()]);return out({notifications:r.results,unreadCount:n.count})}
 const nr=p.match(/^\/api\/notifications\/([\w-]+)\/read$/);if(nr&&m==='POST'){await env.DB.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(new Date().toISOString(),nr[1],me.id).run();return out({ok:true})}
 return err('Rota não encontrada.',404)
}
async function broadcastPost(env,authorId,title,kind){
 const r=await env.DB.prepare("SELECT DISTINCT ps.user_id FROM push_subscriptions ps JOIN users u ON u.id=ps.user_id WHERE ps.user_id<>? AND u.status=\'active\' AND u.deletion_requested_at IS NULL AND COALESCE(json_extract(ps.prefs,'$.novidades'),0)=1 UNION SELECT DISTINCT ft.user_id FROM fcm_tokens ft JOIN users u ON u.id=ft.user_id WHERE ft.user_id<>? AND u.status=\'active\' AND u.deletion_requested_at IS NULL AND COALESCE(json_extract(ft.prefs,'$.novidades'),0)=1").bind(authorId,authorId).all();
 const ids=(r.results||[]).map(x=>x.user_id);for(let i=0;i<ids.length;i+=20){await Promise.allSettled(ids.slice(i,i+20).map(id=>notice(env,id,'post','Novo trabalho no Aquipay',`${title} · ${kind==='job'?'Trabalho':kind==='product'?'Produto':'Serviço'}`,{url:'/'})));}
}
async function purgeExpiredAccounts(env){
 const now=new Date().toISOString(),due=await env.DB.prepare("SELECT id FROM users WHERE status='active' AND deletion_due_at IS NOT NULL AND deletion_due_at<=? ORDER BY deletion_due_at LIMIT 25").bind(now).all();
 for(const row of due.results||[]){
  const id=row.id;
  try{
   const docs=(await env.DB.prepare('SELECT object_key FROM documents WHERE user_id=?').bind(id).all()).results||[];
   const profile=await env.DB.prepare('SELECT avatar_key,resume_key,intro_video_key FROM profiles WHERE user_id=?').bind(id).first();
   if(env.MEDIA){
    const keys=[...docs.map(x=>x.object_key),profile?.avatar_key,profile?.resume_key,profile?.intro_video_key].filter(Boolean);
    let failed=false;
    for(const key of keys){try{await env.MEDIA.delete(key)}catch(e){failed=true;console.error('account media purge',id,e)}}
    if(failed)continue;
   }
   await env.DB.batch([
    env.DB.prepare('DELETE FROM messages WHERE sender_id=? OR conversation_id IN (SELECT id FROM conversations WHERE participant_a=? OR participant_b=?)').bind(id,id,id),
    env.DB.prepare('DELETE FROM conversations WHERE participant_a=? OR participant_b=?').bind(id,id),
    env.DB.prepare('DELETE FROM proposals WHERE sender_id=? OR receiver_id=? OR listing_id IN (SELECT id FROM listings WHERE owner_id=?)').bind(id,id,id),
    env.DB.prepare('DELETE FROM listings WHERE owner_id=?').bind(id),
    env.DB.prepare('DELETE FROM wallet_ledger WHERE user_id=?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id=? AND deletion_due_at IS NOT NULL AND deletion_due_at<=?').bind(id,now)
   ]);
  }catch(e){console.error('account purge failed',id,e)}
 }
}
export default {async fetch(req,env,ctx){const origin=req.headers.get('origin'),allowedList=[env.APP_ORIGIN,...String(env.EXTRA_ORIGINS||'').split(',')].map(x=>x.trim()).filter(Boolean),allowed=allowedList.includes(origin)?origin:(env.APP_ORIGIN||''),cors=origin===allowed?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-max-age':'86400','vary':'Origin'}:{};if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(origin&&origin!==allowed)return err('Origem não autorizada.',403);try{const r=await api(req,env,ctx),h=new Headers(r.headers);for(const[k,v]of Object.entries(cors))h.set(k,v);h.set('x-content-type-options','nosniff');return r.webSocket?new Response(null,{status:101,webSocket:r.webSocket,headers:h}):new Response(r.body,{status:r.status,headers:h})}catch(e){console.error('Aquipay API',e);return err(e.message==='too_large'?'Pedido demasiado grande.':e instanceof SyntaxError?'JSON inválido.':'Erro interno. Tenta novamente.',e.message==='too_large'?413:500)}},async scheduled(controller,env){const now=new Date().toISOString();await env.DB.prepare('DELETE FROM auth_challenges WHERE expires_at<?').bind(now).run();await env.DB.prepare('DELETE FROM call_tickets WHERE expires_at<?').bind(now).run();await purgeExpiredAccounts(env)}};
