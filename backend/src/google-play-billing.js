const enc=new TextEncoder();
const b64u=value=>{const bytes=typeof value==="string"?enc.encode(value):value;let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")};
const fromB64=s=>{const v=String(s).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(v+"=".repeat((4-v.length%4)%4)),c=>c.charCodeAt(0))};
const pemBytes=pem=>fromB64(String(pem||"").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,""));
const clean=(v,n=500)=>typeof v==="string"?v.trim().slice(0,n):"";
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
let cachedAccessToken="",cachedUntil=0;
async function accessToken(env){
 if(cachedAccessToken&&cachedUntil>Date.now()+60000)return cachedAccessToken;
 let account;try{account=JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON||"")}catch{return null}
 if(account?.type!=="service_account"||!account.client_email||!account.private_key)return null;
 const now=Math.floor(Date.now()/1000),head=b64u(JSON.stringify({alg:"RS256",typ:"JWT"})),claim=b64u(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/androidpublisher",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
 const unsigned=head+"."+claim,key=await crypto.subtle.importKey("pkcs8",pemBytes(account.private_key),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,enc.encode(unsigned)));
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+signature})});
 const d=await r.json().catch(()=>({}));if(!r.ok||!d.access_token)return null;
 cachedAccessToken=d.access_token;cachedUntil=Date.now()+Number(d.expires_in||3600)*1000;return cachedAccessToken;
}
async function googleRequest(env,path,method="GET"){
 const token=await accessToken(env);if(!token)throw new Error("google_play_not_configured");
 const r=await fetch("https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"+encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME||"com.aquipay.isabstudio")+path,{method,headers:{authorization:"Bearer "+token,"content-type":"application/json"}});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error("google_play_api_"+r.status);return d;
}
function coinCatalog(env){try{const x=JSON.parse(env.GOOGLE_PLAY_COIN_PRODUCTS||"{}");return x&&typeof x==="object"?x:{}}catch{return {}}}
export async function handleGooglePlayBilling(req,env,me){
 if(req.method!=="POST")return response({error:"Método não permitido."},405);
 if(!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)return response({error:"Validação Google Play ainda não configurada no servidor."},503);
 let b;try{b=await req.json()}catch{return response({error:"Pedido inválido."},400)}
 const type=clean(b.type,20),productId=clean(b.productId,120),purchaseToken=clean(b.purchaseToken,4096);
 if(!["coins","plus"].includes(type)||!productId||purchaseToken.length<20)return response({error:"Dados de compra incompletos."},400);
 const now=new Date().toISOString(),tokenHash=b64u(await crypto.subtle.digest("SHA-256",enc.encode(purchaseToken)));
 if(type==="coins"){
  const catalog=coinCatalog(env),pack=catalog[productId];
  if(!pack||!Number.isInteger(Number(pack.coins))||Number(pack.coins)<1||Number(pack.coins)>100000)return response({error:"Pacote de moedas ainda não configurado."},503);
  let purchase;try{purchase=await googleRequest(env,"/purchases/productsv2/tokens/"+encodeURIComponent(purchaseToken))}catch(e){return response({error:e.message==="google_play_not_configured"?"Credenciais Google Play inválidas ou em falta.":"Não foi possível validar a compra na Google Play."},503)}
  if(purchase.purchaseStateContext?.purchaseState!=="PURCHASED")return response({error:"A Google Play ainda não confirmou esta compra."},409);
  const line=(purchase.productLineItem||[]).find(x=>x.productId===productId);
  if(!line)return response({error:"O produto confirmado não corresponde ao pacote solicitado."},403);
  const existing=await env.DB.prepare("SELECT user_id,product_id FROM google_play_purchases WHERE purchase_token_hash=?").bind(tokenHash).first();
  if(existing&&(existing.user_id!==me.id||existing.product_id!==productId))return response({error:"Esta compra já está associada a outra conta ou produto."},409);
  let credited=false;
  if(!existing){
   const amount=Number(pack.coins)+Number(pack.bonus||0),ledgerKey="googleplay:"+purchaseToken;
   try{
    const result=await env.DB.batch([
     env.DB.prepare("INSERT INTO google_play_purchases(id,user_id,product_id,product_type,purchase_token_hash,order_id,purchase_state,coins_granted,purchase_time_ms,acknowledged,verification_json) VALUES(?,?,?,'inapp',?,?,'purchased',?,?,0,?)").bind(crypto.randomUUID(),me.id,productId,tokenHash,purchase.orderId||null,amount,Date.parse(purchase.purchaseCompletionTime||"")||null,JSON.stringify(purchase)),
     env.DB.prepare("INSERT INTO wallet_ledger(id,user_id,event_type,amount_coins,reference,idempotency_key,status) VALUES(?,?,'google_play_purchase',?,?,?,'posted')").bind(crypto.randomUUID(),me.id,amount,productId,ledgerKey),
     env.DB.prepare("INSERT INTO wallets(user_id,available_coins,pending_coins) VALUES(?,?,0) ON CONFLICT(user_id) DO UPDATE SET available_coins=available_coins+excluded.available_coins,updated_at=?").bind(me.id,amount,now)
    ]);
    credited=!!result?.[0]?.meta?.changes;
   }catch{
    const check=await env.DB.prepare("SELECT user_id FROM google_play_purchases WHERE purchase_token=?").bind(tokenHash).first();
    if(!check)return response({error:"A compra foi validada, mas não foi possível creditar as moedas. Tenta novamente."},503);
   }
  }
  try{await googleRequest(env,"/purchases/products/"+encodeURIComponent(productId)+"/tokens/"+encodeURIComponent(purchaseToken)+":consume","POST")}catch(e){console.error("Google Play consume pending",e.message)}
  const wallet=await env.DB.prepare("SELECT available_coins FROM wallets WHERE user_id=?").bind(me.id).first();
  return response({ok:true,credited,coins:Number(wallet?.available_coins||0),message:credited?"Moedas creditadas.":"Esta compra já tinha sido processada."});
 }
 const plusProduct=clean(env.GOOGLE_PLAY_PLUS_PRODUCT_ID,120),basePlan=clean(env.GOOGLE_PLAY_PLUS_BASE_PLAN_ID,120);
 if(!plusProduct||!basePlan||productId!==plusProduct)return response({error:"Produto Plus ainda não configurado."},503);
 let sub;try{sub=await googleRequest(env,"/purchases/subscriptionsv2/tokens/"+encodeURIComponent(purchaseToken))}catch{return response({error:"Não foi possível validar a assinatura na Google Play."},503)}
 const line=(sub.lineItems||[]).find(x=>x.productId===plusProduct&&x.offerDetails?.basePlanId===basePlan);
 const active=["SUBSCRIPTION_STATE_ACTIVE","SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(sub.subscriptionState),expiresAt=line?.expiryTime;
 if(!line||!active||!expiresAt||Date.parse(expiresAt)<=Date.now())return response({error:"A assinatura Plus não está ativa ou não corresponde ao plano mensal."},409);
 const existing=await env.DB.prepare("SELECT user_id,product_id FROM google_play_purchases WHERE purchase_token_hash=?").bind(tokenHash).first();
 if(existing&&(existing.user_id!==me.id||existing.product_id!==plusProduct))return response({error:"Esta assinatura já está associada a outra conta."},409);
 if(!existing){
  try{await env.DB.prepare("INSERT INTO google_play_purchases(id,user_id,product_id,product_type,purchase_token_hash,order_id,purchase_state,coins_granted,expiry_time_ms,acknowledged,verification_json) VALUES(?,?,?,'subs',?,?,'purchased',0,?,0,?)").bind(crypto.randomUUID(),me.id,plusProduct,tokenHash,sub.latestOrderId||null,Date.parse(expiresAt),JSON.stringify(sub)).run()}catch{
   const check=await env.DB.prepare("SELECT user_id FROM google_play_purchases WHERE purchase_token=?").bind(tokenHash).first();if(check?.user_id!==me.id)return response({error:"Esta assinatura já está associada a outra conta."},409);
  }
 }
 await env.DB.prepare("INSERT INTO user_subscriptions(user_id,product_id,status,expires_at,updated_at) VALUES(?,?,'active',?,?) ON CONFLICT(user_id) DO UPDATE SET product_id=excluded.product_id,status='active',expires_at=MAX(user_subscriptions.expires_at,excluded.expires_at),updated_at=excluded.updated_at").bind(me.id,plusProduct,expiresAt,now).run();
 if(sub.acknowledgementState!=="ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"){
  try{await googleRequest(env,"/purchases/subscriptionsv2/tokens/"+encodeURIComponent(purchaseToken)+":acknowledge","POST")}catch(e){console.error("Google Play subscription acknowledge pending",e.message)}
 }
 return response({ok:true,plusActive:true,expiresAt});
}
