// ATENÇÃO: esta cópia NÃO inclui o código FCM (push Android) que já existe na API publicada na Cloudflare.
// A API em produção já tem estas alterações (recuperação de palavra-passe, eliminar conta, denúncias, bloqueios) mais o FCM.
// Não publiques este ficheiro por cima; para o teu repositório usa backend/account-safety.patch.
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
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
async function session(userId,env){const token=b64(crypto.getRandomValues(new Uint8Array(32))),expires=new Date(Date.now()+30*86400000).toISOString();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),userId,expires).run();return{token,expiresAt:expires}}
async function current(req,env){const h=req.headers.get('authorization')||'',t=h.startsWith('Bearer ')?h.slice(7):'';if(!t)return null;return env.DB.prepare("SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'").bind(await digest(t),new Date().toISOString()).first()}
async function notice(env,userId,kind,title,body,data={}){await env.DB.prepare('INSERT INTO notifications(id,user_id,kind,title,body,data_json) VALUES(?,?,?,?,?,?)').bind(uid(),userId,kind,title.slice(0,100),body.slice(0,500),JSON.stringify(data)).run();await pushTo(env,userId,kind,title,body)}
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
  let u=await env.DB.prepare('SELECT id,name,email,status FROM users WHERE google_sub=?').bind(c.sub).first(),created=false;
  if(!u){
    u=await env.DB.prepare('SELECT id,name,email,status FROM users WHERE email=?').bind(email).first();
    if(u&&u.status==='active')await env.DB.prepare('UPDATE users SET google_sub=? WHERE id=? AND google_sub IS NULL').bind(c.sub,u.id).run();
  }
  if(!u){
    const id=uid(),name=clean(c.name,80)||email.split('@')[0],salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=b64(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.batch([env.DB.prepare('INSERT INTO users(id,name,email,password_hash,password_salt,google_sub) VALUES(?,?,?,?,?,?)').bind(id,name.length>=2?name:email,email,hash,salt,c.sub),env.DB.prepare('INSERT INTO profiles(user_id) VALUES(?)').bind(id),env.DB.prepare('INSERT INTO wallets(user_id) VALUES(?)').bind(id)]);
    u={id,name,email,status:'active'};created=true;
  }
  if(u.status!=='active')return err('Conta indisponível.',403);
  return out({user:{id:u.id,name:u.name,email:u.email},...await session(u.id,env)},created?201:200);
}
const PUSH_HOSTS=['googleapis.com','mozilla.com','push.apple.com','windows.com','samsung.com'];
const PUSH_PREF={proposal:'candidaturas',proposal_status:'candidaturas',rating:'candidaturas',message:'mensagens'};
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
    body:JSON.stringify({message:{token,notification:{title:payload.title,body:payload.body},data:{url:String(payload.url||'/'),kind:String(payload.kind||'novidades')},android:{priority:'HIGH',notification:{channel_id:'default',sound:'default'}}}}),
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
async function pushTo(env,userId,kind,title,body){
  const pref=PUSH_PREF[kind]||'novidades',payload={title:title.slice(0,80),body:body.slice(0,200),url:'/',kind};
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
async function api(req,env){const u=new URL(req.url),p=u.pathname,m=req.method;
 if(p==='/api/health'&&m==='GET')return out({ok:true,service:'aquipay-api'});
 // Pesquisa e perfil público: apenas dados profissionais publicados pelo próprio titular.
 if(p==='/api/users'&&m==='GET'){const q=clean(u.searchParams.get('q'),80);if(q.length<2)return out({users:[]});const viewer=await current(req,env).catch(()=>null);const r=await env.DB.prepare("SELECT u.id,u.name,p.city,p.bio,p.professions_json,p.skills_json,p.portfolio_json,p.experience_json,p.education_json,p.updated_at FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.status='active' AND p.public_profile=1 AND (u.name LIKE '%'||?||'%' OR p.city LIKE '%'||?||'%' OR p.bio LIKE '%'||?||'%' OR p.professions_json LIKE '%'||?||'%') AND (? IS NULL OR (u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?) AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id=?))) ORDER BY u.name LIMIT 30").bind(q,q,q,q,viewer?viewer.id:null,viewer?viewer.id:null,viewer?viewer.id:null).all();return out({users:r.results})}
 const publicDoc=p.match(/^\/api\/public-documents\/([\w-]+)$/);if(publicDoc&&m==='GET'){const d=await env.DB.prepare('SELECT d.original_name,d.content_type,d.object_key,d.size_bytes FROM documents d JOIN profiles p ON p.user_id=d.user_id AND p.public_profile=1 WHERE d.id=? AND d.is_public=1').bind(publicDoc[1]).first();if(!d)return err('Documento público não encontrado.',404);const obj=await env.MEDIA.get(d.object_key);if(!obj)return err('Ficheiro não encontrado.',404);return new Response(obj.body,{headers:{'content-type':d.content_type,'content-length':String(d.size_bytes),'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.original_name)}`,'cache-control':'public, max-age=300','x-content-type-options':'nosniff'}})}
 const pub=p.match(/^\/api\/users\/([\w-]+)$/);if(pub&&m==='GET'){const r=await env.DB.prepare("SELECT u.id,u.name,u.created_at,p.city,p.bio,p.professions_json,p.skills_json,p.portfolio_json,p.experience_json,p.education_json FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=? AND u.status='active' AND p.public_profile=1").bind(pub[1]).first();if(!r)return err('Perfil não encontrado ou privado.',404);const rating=await env.DB.prepare('SELECT COUNT(*) count,ROUND(AVG(stars),1) average FROM profile_ratings WHERE target_user_id=?').bind(pub[1]).first();const reviews=await env.DB.prepare('SELECT r.stars,r.comment,r.created_at,u.name reviewer_name FROM profile_ratings r JOIN users u ON u.id=r.reviewer_user_id WHERE r.target_user_id=? ORDER BY r.created_at DESC LIMIT 20').bind(pub[1]).all();const docs=await env.DB.prepare('SELECT id,category,original_name,content_type,size_bytes,created_at FROM documents WHERE user_id=? AND is_public=1 ORDER BY created_at DESC').bind(pub[1]).all();return out({profile:r,ratings:{count:rating.count,average:rating.average||0,reviews:reviews.results},documents:docs.results})}
 if(p==='/api/auth/google'&&m==='POST')return googleAuth(req,env);
 if(p==='/api/auth/register'&&m==='POST'){const rl=await limited(req,env,'reg',8,3600);if(rl)return rl;const b=await json(req),name=clean(b.name,80),email=clean(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'';if(name.length<2||!emailOk(email)||password.length<10)return err('Nome, email válido e palavra-passe com pelo menos 10 caracteres são obrigatórios.');const exists=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();if(exists)return err('Email já registado.',409);const id=uid(),salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passHash(password,salt);try{await env.DB.batch([env.DB.prepare('INSERT INTO users(id,name,email,password_hash,password_salt) VALUES(?,?,?,?,?)').bind(id,name,email,hash,salt),env.DB.prepare('INSERT INTO profiles(user_id) VALUES(?)').bind(id),env.DB.prepare('INSERT INTO wallets(user_id) VALUES(?)').bind(id)])}catch{return err('Não foi possível criar a conta.',409)}return out({user:{id,name,email},...await session(id,env)},201)}
 if(p==='/api/auth/login'&&m==='POST'){const rl=await limited(req,env,'login',10,900);if(rl)return rl;const b=await json(req),email=clean(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'';const x=await env.DB.prepare("SELECT id,name,email,password_hash,password_salt,status FROM users WHERE email=?").bind(email).first();if(!x||x.status!=='active'||!password||await passHash(password,x.password_salt)!==x.password_hash)return err('Email ou palavra-passe incorretos.',401);return out({user:{id:x.id,name:x.name,email:x.email},...await session(x.id,env)})}
 if(p==='/api/auth/forgot'&&m==='POST'){const rl=await limited(req,env,'forgot',5,3600);if(rl)return rl;const b=await json(req,2000),email=clean(b.email,254).toLowerCase(),lang=['pt','en','fr','zh'].includes(b.lang)?b.lang:'pt';if(emailOk(email)){const x=await env.DB.prepare('SELECT id,name,status FROM users WHERE email=?').bind(email).first();if(x&&x.status==='active'){const token=b64(crypto.getRandomValues(new Uint8Array(32)));await env.DB.batch([env.DB.prepare('DELETE FROM password_resets WHERE user_id=?').bind(x.id),env.DB.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),x.id,new Date(Date.now()+3600000).toISOString())]);await sendReset(env,email,x.name,token,lang)}}return out({ok:true})}
 if(p==='/api/auth/reset'&&m==='POST'){const rl=await limited(req,env,'reset',10,3600);if(rl)return rl;const b=await json(req,2000),token=clean(b.token,200),pw=typeof b.password==='string'?b.password:'';if(pw.length<10||pw.length>200)return err('A palavra-passe deve ter pelo menos 10 caracteres.');const r=token?await env.DB.prepare('SELECT user_id,expires_at FROM password_resets WHERE token_hash=?').bind(await digest(token)).first():null;if(!r||r.expires_at<new Date().toISOString())return err('Link de recuperação inválido ou expirado.');const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passHash(pw,salt);await env.DB.batch([env.DB.prepare("UPDATE users SET password_hash=?,password_salt=? WHERE id=? AND status='active'").bind(hash,salt,r.user_id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(r.user_id),env.DB.prepare('DELETE FROM password_resets WHERE user_id=?').bind(r.user_id)]);return out({ok:true})}
 const me=await current(req,env);if(!me)return err('Sessão inválida ou expirada.',401);
 if(p==='/api/push/subscribe'&&m==='POST')return pushSubscribe(req,env,me);
 if(p==='/api/push/fcm/register'&&m==='POST')return registerFcmToken(req,env,me);
 if(p==='/api/push/fcm/unregister'&&m==='POST'){const b=await json(req,3000),token=clean(b.token,4096);await env.DB.prepare('DELETE FROM fcm_tokens WHERE token=? AND user_id=?').bind(token,me.id).run();return out({ok:true})}
 if(p==='/api/push/unsubscribe'&&m==='POST'){const b=await json(req,2000);await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').bind(clean(b.endpoint,600),me.id).run();return out({ok:true})}
 if(p==='/api/auth/logout'&&m==='POST'){const t=(req.headers.get('authorization')||'').slice(7);await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(t)).run();return out({ok:true})}
 if(p==='/api/auth/password'&&m==='POST'){const rl=await limited(req,env,'pwchange',6,900);if(rl)return rl;const b=await json(req,2000),cur=typeof b.currentPassword==='string'?b.currentPassword:'',nw=typeof b.newPassword==='string'?b.newPassword:'';const x=await env.DB.prepare('SELECT password_hash,password_salt,google_sub FROM users WHERE id=?').bind(me.id).first();if(!x)return err('Conta indisponível.',404);if(x.google_sub)return err('Esta conta usa o Google para entrar.');if(nw.length<10||nw.length>200)return err('A palavra-passe deve ter pelo menos 10 caracteres.');if(await passHash(cur,x.password_salt)!==x.password_hash)return err('Palavra-passe atual incorreta.',403);if(nw===cur)return err('A nova palavra-passe tem de ser diferente da atual.');const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passHash(nw,salt),t=(req.headers.get('authorization')||'').slice(7);await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').bind(hash,salt,me.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(me.id,await digest(t))]);return out({ok:true})}
 if(p==='/api/me'&&m==='DELETE'){const rl=await limited(req,env,'delacct',5,3600);if(rl)return rl;const b=await json(req,2000),x=await env.DB.prepare('SELECT password_hash,password_salt,google_sub,email FROM users WHERE id=?').bind(me.id).first();if(!x)return err('Conta indisponível.',404);if(x.google_sub){if(String(b.confirmEmail||'').trim().toLowerCase()!==String(x.email).toLowerCase())return err('Confirmação incorreta.',403)}else if(typeof b.password!=='string'||await passHash(b.password,x.password_salt)!==x.password_hash)return err('Palavra-passe atual incorreta.',403);const docs=((await env.DB.prepare('SELECT object_key FROM documents WHERE user_id=?').bind(me.id).all()).results)||[],av=await env.DB.prepare('SELECT avatar_key FROM profiles WHERE user_id=?').bind(me.id).first();if(env.MEDIA){for(const d of docs){try{await env.MEDIA.delete(d.object_key)}catch{}}if(av&&av.avatar_key){try{await env.MEDIA.delete(av.avatar_key)}catch{}}}const now=new Date().toISOString(),junk=()=>b64(crypto.getRandomValues(new Uint8Array(32)));await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(me.id),env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id=?').bind(me.id),env.DB.prepare('DELETE FROM fcm_tokens WHERE user_id=?').bind(me.id),env.DB.prepare('DELETE FROM notifications WHERE user_id=?').bind(me.id),env.DB.prepare('DELETE FROM documents WHERE user_id=?').bind(me.id),env.DB.prepare('DELETE FROM profile_ratings WHERE target_user_id=? OR reviewer_user_id=?').bind(me.id,me.id),env.DB.prepare('DELETE FROM blocks WHERE blocker_id=? OR blocked_id=?').bind(me.id,me.id),env.DB.prepare('DELETE FROM password_resets WHERE user_id=?').bind(me.id),env.DB.prepare('DELETE FROM profiles WHERE user_id=?').bind(me.id),env.DB.prepare("UPDATE listings SET status='removed',title='[removido]',description='',media_json='[]',updated_at=? WHERE owner_id=?").bind(now,me.id),env.DB.prepare("UPDATE proposals SET status='cancelled',updated_at=? WHERE (sender_id=? OR receiver_id=?) AND status IN ('sent','accepted')").bind(now,me.id,me.id),env.DB.prepare("UPDATE proposals SET message='[removido]' WHERE sender_id=?").bind(me.id),env.DB.prepare("UPDATE messages SET body='[removido]' WHERE sender_id=?").bind(me.id),env.DB.prepare("UPDATE users SET status='deleted',name='Conta eliminada',email=?,password_hash=?,password_salt=?,google_sub=NULL WHERE id=?").bind('deleted-'+me.id+'@deleted.invalid',junk(),junk(),me.id)]);return out({ok:true})}
 if(p==='/api/reports'&&m==='POST'){const rl=await limited(req,env,'report',20,3600);if(rl)return rl;const b=await json(req,4000),type=['user','listing'].includes(b.targetType)?b.targetType:'',tid=clean(b.targetId,80),reason=['spam','fraud','abuse','illegal','fake','other'].includes(b.reason)?b.reason:'',details=clean(b.details,1000);if(!type||!tid||!reason||(type==='user'&&tid===me.id))return err('Denúncia inválida.');const ok=type==='user'?await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(tid).first():await env.DB.prepare('SELECT id FROM listings WHERE id=?').bind(tid).first();if(!ok)return err('Denúncia inválida.');const r=await env.DB.prepare('INSERT OR IGNORE INTO reports(id,reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?,?)').bind(uid(),me.id,type,tid,reason,details).run();return out({ok:true,duplicate:!(r.meta&&r.meta.changes>0)},201)}
 if(p==='/api/blocks'&&m==='GET'){const r=await env.DB.prepare('SELECT u.id,u.name FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC').bind(me.id).all();return out({blocks:r.results})}
 if(p==='/api/blocks'&&m==='POST'){const b=await json(req,1000),tid=clean(b.userId,80);if(!tid||tid===me.id)return err('Utilizador não encontrado.',404);const t=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(tid).first();if(!t)return err('Utilizador não encontrado.',404);await env.DB.prepare('INSERT OR IGNORE INTO blocks(blocker_id,blocked_id) VALUES(?,?)').bind(me.id,tid).run();return out({ok:true},201)}
 const blk=p.match(/^\/api\/blocks\/([\w-]+)$/);if(blk&&m==='DELETE'){await env.DB.prepare('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?').bind(me.id,blk[1]).run();return out({ok:true})}
 if(p==='/api/me'&&m==='GET'){const [profile,wallet]=await Promise.all([env.DB.prepare('SELECT * FROM profiles WHERE user_id=?').bind(me.id).first(),env.DB.prepare('SELECT available_coins,pending_coins FROM wallets WHERE user_id=?').bind(me.id).first()]);return out({user:me,profile,wallet})}
 if(p==='/api/profile'&&m==='PATCH'){const b=await json(req),arr=(v,n)=>JSON.stringify(Array.isArray(v)?v.slice(0,n):[]);await env.DB.batch([env.DB.prepare('UPDATE users SET name=? WHERE id=?').bind(clean(b.name,80)||me.name,me.id),env.DB.prepare('UPDATE profiles SET city=?,phone=?,bio=?,professions_json=?,skills_json=?,portfolio_json=?,experience_json=?,education_json=?,public_profile=?,updated_at=? WHERE user_id=?').bind(clean(b.city,100),clean(b.phone,40),clean(b.bio,2000),arr(b.professions,20),arr(b.skills,40),arr(b.portfolio,30),arr(b.experience,30),arr(b.education,30),b.publicProfile===false?0:1,new Date().toISOString(),me.id)]);return out({ok:true})}
 if(p==='/api/ratings'&&m==='POST'){const b=await json(req),target=clean(b.targetUserId,80),stars=Number(b.stars),comment=clean(b.comment,800);if(!target||target===me.id||!Number.isInteger(stars)||stars<1||stars>5)return err('Classificação inválida.');const targetExists=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(target).first();if(!targetExists)return err('Utilizador não encontrado.',404);const interaction=await env.DB.prepare("SELECT 1 ok FROM proposals p WHERE p.status IN ('accepted','completed') AND ((p.sender_id=? AND p.receiver_id=?) OR (p.sender_id=? AND p.receiver_id=?)) LIMIT 1").bind(me.id,target,target,me.id).first();if(!interaction)return err('Só podes classificar alguém com quem tiveste uma proposta aceite ou concluída.',403);try{await env.DB.prepare('INSERT INTO profile_ratings(id,target_user_id,reviewer_user_id,stars,comment) VALUES(?,?,?,?,?)').bind(uid(),target,me.id,stars,comment).run()}catch{return err('Já classificaste este perfil ou a avaliação não pôde ser guardada.',409)}await notice(env,target,'rating','Nova classificação',`${me.name} avaliou o teu perfil com ${stars} estrela(s).`,{reviewerId:me.id});return out({ok:true},201)}
 // Upload privado de CV, certificados, portfólio e vídeo de apresentação.
 if(p==='/api/documents'&&m==='POST'){if(!env.MEDIA)return err('Armazenamento de ficheiros indisponível.',503);const ct=req.headers.get('content-type')||'';if(!ct.includes('multipart/form-data'))return err('Envia o ficheiro em multipart/form-data.');const form=await req.formData(),file=form.get('file'),category=clean(form.get('category'),30);const allowed=['cv','certificate','portfolio','experience','education','intro_video'];if(!(file instanceof File)||!allowed.includes(category))return err('Ficheiro ou categoria inválidos.');const video=category==='intro_video',isPublic=form.get('isPublic')==='true',limit=video?20*1024*1024:10*1024*1024;if(file.size<1||file.size>limit)return err(video?'O vídeo deve ter no máximo 20 MB.':'O documento deve ter no máximo 10 MB.');const types=video?['video/mp4','video/webm','video/quicktime']:['application/pdf','image/jpeg','image/png','image/webp'];if(!types.includes(file.type))return err('Formato não permitido. Usa PDF, JPG, PNG, WEBP ou MP4/WEBM para vídeo.');const bytes=await file.arrayBuffer(),head=new Uint8Array(bytes.slice(0,16));const hex=[...head].map(x=>x.toString(16).padStart(2,'0')).join('');const valid=file.type==='application/pdf'?hex.startsWith('25504446'):file.type==='image/jpeg'?hex.startsWith('ffd8ff'):file.type==='image/png'?hex.startsWith('89504e470d0a1a0a'):file.type==='image/webp'?String.fromCharCode(...head.slice(8,12))==='WEBP':file.type==='video/mp4'?String.fromCharCode(...head.slice(4,8))==='ftyp':file.type==='video/webm'?hex.startsWith('1a45dfa3'):file.type==='video/quicktime'?String.fromCharCode(...head.slice(4,8))==='ftyp':false;if(!valid)return err('O conteúdo do ficheiro não corresponde ao formato indicado.');const id=uid(),key=`private/${me.id}/${id}`,name=clean(file.name.replace(/[\\/\\\\]/g,'_'),180)||'documento';await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:file.type,cacheControl:'private, no-store'},customMetadata:{ownerId:me.id,category,originalName:name}});try{await env.DB.prepare('INSERT INTO documents(id,user_id,category,original_name,content_type,object_key,size_bytes,is_public) VALUES(?,?,?,?,?,?,?,?)').bind(id,me.id,category,name,file.type,key,file.size,isPublic?1:0).run()}catch(e){await env.MEDIA.delete(key);throw e}return out({id,category,name,size:file.size,isPublic,createdAt:new Date().toISOString()},201)}
 if(p==='/api/documents'&&m==='GET'){const r=await env.DB.prepare('SELECT id,category,original_name,content_type,size_bytes,is_public,created_at FROM documents WHERE user_id=? ORDER BY created_at DESC').bind(me.id).all();return out({documents:r.results})}
 const doc=p.match(/^\/api\/documents\/([\w-]+)$/);if(doc){const d=await env.DB.prepare('SELECT id,user_id,original_name,content_type,object_key,size_bytes FROM documents WHERE id=? AND user_id=?').bind(doc[1],me.id).first();if(!d)return err('Documento não encontrado.',404);if(m==='DELETE'){await env.MEDIA.delete(d.object_key);await env.DB.prepare('DELETE FROM documents WHERE id=? AND user_id=?').bind(d.id,me.id).run();return out({ok:true})}if(m==='GET'){const obj=await env.MEDIA.get(d.object_key);if(!obj)return err('Ficheiro não encontrado.',404);return new Response(obj.body,{headers:{'content-type':d.content_type,'content-length':String(d.size_bytes),'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.original_name)}`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}})}}
 if(p==='/api/listings'&&m==='GET'){const k=u.searchParams.get('kind'),q=clean(u.searchParams.get('q'),100),kind=['job','product','service'].includes(k)?k:null;const r=await env.DB.prepare("SELECT l.id,l.owner_id,l.kind,l.title,l.description,l.price_minor,l.currency,l.city,l.media_json,l.created_at,u.name owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.status='active' AND (? IS NULL OR l.kind=?) AND (?='' OR l.title LIKE '%'||?||'%' OR l.description LIKE '%'||?||'%' OR l.city LIKE '%'||?||'%') ORDER BY l.created_at DESC LIMIT 100").bind(kind,kind,q,q,q,q).all();return out({listings:r.results})}
 if(p==='/api/listings'&&m==='POST'){const b=await json(req,20000),kind=b.kind,title=clean(b.title,120),desc=clean(b.description,5000),price=b.priceMinor==null?null:Number(b.priceMinor);if(!['job','product','service'].includes(kind)||title.length<3||desc.length<5||(price!==null&&(!Number.isSafeInteger(price)||price<0)))return err('Dados do anúncio inválidos.');const id=uid();await env.DB.prepare('INSERT INTO listings(id,owner_id,kind,title,description,price_minor,currency,city) VALUES(?,?,?,?,?,?,?,?)').bind(id,me.id,kind,title,desc,price,'AOA',clean(b.city,100)).run();return out({id,ok:true},201)}
 if(p==='/api/proposals'&&m==='POST'){const b=await json(req,12000),listingId=clean(b.listingId,80),message=clean(b.message,4000),listing=await env.DB.prepare("SELECT id,owner_id,title FROM listings WHERE id=? AND status='active'").bind(listingId).first(),price=b.priceMinor==null?null:Number(b.priceMinor);if(!listing||listing.owner_id===me.id||message.length<10||(price!==null&&(!Number.isSafeInteger(price)||price<0)))return err('Proposta inválida.');if(await env.DB.prepare('SELECT 1 x FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').bind(me.id,listing.owner_id,listing.owner_id,me.id).first())return err('Não é possível enviar propostas a este utilizador.',403);const proposalId=uid(),conversationId=uid();await env.DB.batch([env.DB.prepare('INSERT INTO proposals(id,listing_id,sender_id,receiver_id,message,price_minor,delivery_days) VALUES(?,?,?,?,?,?,?)').bind(proposalId,listingId,me.id,listing.owner_id,message,price,Number.isInteger(b.deliveryDays)?Math.max(1,Math.min(365,b.deliveryDays)):null),env.DB.prepare('INSERT INTO conversations(id,proposal_id,participant_a,participant_b) VALUES(?,?,?,?)').bind(conversationId,proposalId,me.id,listing.owner_id)]);await notice(env,listing.owner_id,'proposal','Nova proposta',`${me.name} enviou uma proposta para «${listing.title}».`,{proposalId,conversationId});return out({proposalId,conversationId,ok:true},201)}
 const pr=p.match(/^\/api\/proposals\/([\w-]+)$/);if(pr&&m==='PATCH'){const b=await json(req),status=b.status,proposal=await env.DB.prepare('SELECT id,sender_id,receiver_id,status FROM proposals WHERE id=?').bind(pr[1]).first();if(!proposal)return err('Proposta não encontrada.',404);if(!['accepted','rejected','completed'].includes(status))return err('Estado inválido.');const receiver=proposal.receiver_id===me.id,sender=proposal.sender_id===me.id;if(status==='accepted'||status==='rejected'){if(!receiver||proposal.status!=='sent')return err('Só quem publicou o anúncio pode aceitar ou recusar uma proposta enviada.',403)}else if(!(receiver||sender)||proposal.status!=='accepted')return err('Só os participantes podem concluir uma proposta aceite.',403);await env.DB.prepare('UPDATE proposals SET status=?,updated_at=? WHERE id=?').bind(status,new Date().toISOString(),proposal.id).run();const recipient=receiver?proposal.sender_id:proposal.receiver_id;await notice(env,recipient,'proposal_status','Atualização da proposta',status==='accepted'?'A tua proposta foi aceite.':status==='rejected'?'A tua proposta foi recusada.':'A proposta foi marcada como concluída.',{proposalId:proposal.id,status});return out({ok:true,status})}
 if(p==='/api/conversations'&&m==='GET'){const r=await env.DB.prepare('SELECT c.id,c.proposal_id,c.created_at,CASE WHEN c.participant_a=? THEN c.participant_b ELSE c.participant_a END other_user_id,u.name other_user_name,(SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message,(SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) unread_count FROM conversations c JOIN users u ON u.id=CASE WHEN c.participant_a=? THEN c.participant_b ELSE c.participant_a END WHERE c.participant_a=? OR c.participant_b=? ORDER BY c.created_at DESC').bind(me.id,me.id,me.id,me.id,me.id).all();return out({conversations:r.results})}
 const cm=p.match(/^\/api\/conversations\/([\w-]+)\/messages$/);if(cm){const cid=cm[1],c=await env.DB.prepare('SELECT id,participant_a,participant_b FROM conversations WHERE id=? AND (participant_a=? OR participant_b=?)').bind(cid,me.id,me.id).first();if(!c)return err('Conversa não encontrada.',404);if(m==='GET'){const r=await env.DB.prepare('SELECT id,sender_id,body,read_at,created_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT 200').bind(cid).all();await env.DB.prepare('UPDATE messages SET read_at=? WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL').bind(new Date().toISOString(),cid,me.id).run();return out({messages:r.results})}if(m==='POST'){const b=await json(req),body=clean(b.body,4000);if(!body)return err('Escreve uma mensagem.');const recipient=c.participant_a===me.id?c.participant_b:c.participant_a,id=uid();await env.DB.prepare('INSERT INTO messages(id,conversation_id,sender_id,body) VALUES(?,?,?,?)').bind(id,cid,me.id,body).run();await notice(env,recipient,'message','Nova mensagem',`${me.name} enviou-te uma mensagem.`,{conversationId:cid});return out({id,ok:true},201)}}
 if(p==='/api/notifications'&&m==='GET'){const [r,n]=await Promise.all([env.DB.prepare('SELECT id,kind,title,body,data_json,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(me.id).all(),env.DB.prepare('SELECT COUNT(*) count FROM notifications WHERE user_id=? AND read_at IS NULL').bind(me.id).first()]);return out({notifications:r.results,unreadCount:n.count})}
 const nr=p.match(/^\/api\/notifications\/([\w-]+)\/read$/);if(nr&&m==='POST'){await env.DB.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(new Date().toISOString(),nr[1],me.id).run();return out({ok:true})}
 return err('Rota não encontrada.',404)
}
export default {async fetch(req,env){const origin=req.headers.get('origin'),allowedList=[env.APP_ORIGIN,...String(env.EXTRA_ORIGINS||'').split(',')].map(x=>x.trim()).filter(Boolean),allowed=allowedList.includes(origin)?origin:(env.APP_ORIGIN||''),cors=origin===allowed?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-max-age':'86400','vary':'Origin'}:{};if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(origin&&origin!==allowed)return err('Origem não autorizada.',403);try{const r=await api(req,env),h=new Headers(r.headers);for(const[k,v]of Object.entries(cors))h.set(k,v);h.set('x-content-type-options','nosniff');return new Response(r.body,{status:r.status,headers:h})}catch(e){console.error('Aquipay API',e);return err(e.message==='too_large'?'Pedido demasiado grande.':e instanceof SyntaxError?'JSON inválido.':'Erro interno. Tenta novamente.',e.message==='too_large'?413:500)}}};