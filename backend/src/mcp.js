const enc = new TextEncoder();
const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};
const response = (body, status=200) => new Response(JSON.stringify(body), {status, headers});
const rpcError = (id, code, message) => response({jsonrpc:"2.0", id:id ?? null, error:{code,message}});
const b64 = bytes => {
  let value="";
  for (const byte of new Uint8Array(bytes)) value+=String.fromCharCode(byte);
  return btoa(value).split("+").join("-").split("/").join("_").replace(/=+$/g,"");
};
const sha256 = async value => b64(await crypto.subtle.digest("SHA-256", enc.encode(value)));
const textResult = value => ({content:[{type:"text",text:JSON.stringify(value)}]});

async function authenticatedUser(request, env) {
  const auth=request.headers.get("authorization") || "";
  const token=auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 512) return null;
  const tokenHash=await sha256(token),now=new Date().toISOString();
  const oauth=await env.DB.prepare(
    "SELECT u.id,u.name,u.email,u.deletion_requested_at,t.scopes FROM oauth_tokens t JOIN users u ON u.id=t.user_id WHERE t.access_hash=? AND t.access_expires_at>? AND t.refresh_expires_at>? AND t.revoked_at IS NULL AND t.resource='https://api.aquipay.isabstudio.dev/mcp' AND u.status='active' AND u.deletion_requested_at IS NULL"
  ).bind(tokenHash,now,now).first();
  if(oauth){
    await env.DB.prepare("UPDATE oauth_tokens SET last_used_at=? WHERE access_hash=? AND revoked_at IS NULL").bind(now,tokenHash).run();
    return {...oauth,scopes:String(oauth.scopes||"").split(/\s+/).filter(Boolean)};
  }
  const session=await env.DB.prepare(
    "SELECT u.id,u.name,u.email,u.deletion_requested_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'"
  ).bind(tokenHash,now).first();
  return session?{...session,scopes:["profile:read","listings:read","proposals:read","credits:read","conversations:read"]}:null;
}

const tools = [
  {
    name:"aquipay_search_listings",
    description:"Pesquisa trabalhos, serviços e produtos publicados no AquiPay. Requer conta autenticada.",
    inputSchema:{type:"object",properties:{
      query:{type:"string",description:"Palavras para pesquisar no título, descrição ou cidade."},
      kind:{type:"string",enum:["job","service","product"],description:"Tipo de anúncio."},
      country:{type:"string",description:"Código ISO de país com duas letras, por exemplo AO."},
      limit:{type:"integer",minimum:1,maximum:30}
    },additionalProperties:false}
  },
  {
    name:"aquipay_get_my_profile",
    description:"Consulta os dados profissionais do perfil do utilizador autenticado.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  {
    name:"aquipay_get_my_credits",
    description:"Consulta o saldo de créditos e o saldo pendente da conta autenticada. Os créditos são funcionalidades virtuais, não dinheiro.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  {
    name:"aquipay_list_my_listings",
    description:"Lista os anúncios publicados pelo utilizador autenticado.",
    inputSchema:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:50}},additionalProperties:false}
  },
  {
    name:"aquipay_list_my_proposals",
    description:"Consulta propostas enviadas e recebidas pelo utilizador autenticado.",
    inputSchema:{type:"object",properties:{status:{type:"string",enum:["sent","accepted","rejected","withdrawn","completed","cancelled"]},limit:{type:"integer",minimum:1,maximum:50}},additionalProperties:false}
  },
  {
    name:"aquipay_create_listing",
    description:"Publica um anúncio na conta AquiPay autenticada. Só publica quando confirm=true. Respeita os limites gratuitos e o plano Plus.",
    inputSchema:{type:"object",required:["kind","title","description","confirm"],properties:{
      kind:{type:"string",enum:["job","service","product"]},title:{type:"string",minLength:3,maxLength:120},
      description:{type:"string",minLength:5,maxLength:5000},priceMinor:{type:["integer","null"],minimum:0},
      currency:{type:"string",pattern:"^[A-Z]{3}$"},city:{type:"string",maxLength:100},country:{type:"string",pattern:"^[A-Z]{2}$"},
      confirm:{type:"boolean",description:"Tem de ser true para publicar o anúncio."}
    },additionalProperties:false}
  },
  {
    name:"aquipay_update_my_listing",
    description:"Edita um anúncio próprio ainda ativo. Só altera quando confirm=true.",
    inputSchema:{type:"object",required:["listingId","confirm"],properties:{
      listingId:{type:"string"},title:{type:"string",minLength:3,maxLength:120},description:{type:"string",minLength:5,maxLength:5000},
      priceMinor:{type:["integer","null"],minimum:0},currency:{type:"string",pattern:"^[A-Z]{3}$"},city:{type:"string",maxLength:100},country:{type:"string",pattern:"^[A-Z]{2}$"},
      confirm:{type:"boolean"}
    },additionalProperties:false}
  },
  {
    name:"aquipay_remove_my_listing",
    description:"Remove um anúncio próprio e cancela propostas ainda abertas. Exige confirm=true.",
    inputSchema:{type:"object",required:["listingId","confirm"],properties:{listingId:{type:"string"},confirm:{type:"boolean"}},additionalProperties:false}
  },
  {
    name:"aquipay_send_proposal",
    description:"Envia uma candidatura/proposta para um anúncio ativo de outra pessoa. Exige confirm=true e respeita limites diários.",
    inputSchema:{type:"object",required:["listingId","message","confirm"],properties:{
      listingId:{type:"string"},message:{type:"string",minLength:10,maxLength:4000},priceMinor:{type:["integer","null"],minimum:0},
      deliveryDays:{type:"integer",minimum:1,maximum:365},confirm:{type:"boolean"}
    },additionalProperties:false}
  },
  {
    name:"aquipay_update_proposal_status",
    description:"Aceita, recusa ou marca como concluída uma proposta conforme as regras de autorização do AquiPay. Exige confirm=true.",
    inputSchema:{type:"object",required:["proposalId","status","confirm"],properties:{
      proposalId:{type:"string"},status:{type:"string",enum:["accepted","rejected","completed"]},confirm:{type:"boolean"}
    },additionalProperties:false}
  },

  {
    name:"aquipay_get_my_stats",
    description:"Mostra estatísticas da atividade do utilizador: anúncios, propostas, conversas, mensagens e seguidores.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  {
    name:"aquipay_update_my_profile",
    description:"Atualiza o perfil profissional próprio. Exige confirm=true.",
    inputSchema:{type:"object",required:["confirm"],properties:{
      name:{type:"string",minLength:2,maxLength:80},city:{type:"string",maxLength:100},bio:{type:"string",maxLength:2000},
      professions:{type:"array",items:{type:"string",maxLength:80},maxItems:20},
      skills:{type:"array",items:{type:"string",maxLength:80},maxItems:50},confirm:{type:"boolean"}
    },additionalProperties:false}
  },
  {
    name:"aquipay_list_my_notifications",
    description:"Lista notificações da conta autenticada, incluindo estado de leitura.",
    inputSchema:{type:"object",properties:{unreadOnly:{type:"boolean"},limit:{type:"integer",minimum:1,maximum:50}},additionalProperties:false}
  },
  {
    name:"aquipay_mark_notifications_read",
    description:"Marca como lidas notificações próprias. Pode marcar uma notificação ou todas. Exige confirm=true.",
    inputSchema:{type:"object",required:["confirm"],properties:{notificationId:{type:"string"},confirm:{type:"boolean"}},additionalProperties:false}
  },
  {
    name:"aquipay_get_conversation_messages",
    description:"Consulta mensagens de uma conversa da qual o utilizador autenticado é participante.",
    inputSchema:{type:"object",required:["conversationId"],properties:{conversationId:{type:"string"},limit:{type:"integer",minimum:1,maximum:100}},additionalProperties:false}
  },
  {
    name:"aquipay_send_message",
    description:"Envia mensagem numa conversa da qual o utilizador autenticado é participante. Exige confirm=true.",
    inputSchema:{type:"object",required:["conversationId","message","confirm"],properties:{conversationId:{type:"string"},message:{type:"string",minLength:1,maxLength:4000},confirm:{type:"boolean"}},additionalProperties:false}
  },
  {
    name:"aquipay_get_subscription",
    description:"Consulta o plano atual e a data de validade da subscrição AquiPay.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  {
    name:"aquipay_list_my_conversations",
    description:"Lista conversas do utilizador autenticado sem expor mensagens de outras contas.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  }
];

async function callTool(name,args,env,user) {
  if (user.deletion_requested_at) throw new Error("A conta está marcada para eliminação. Cancela o pedido na aplicação antes de usar o conector.");
  if (name==="aquipay_search_listings") {
    const q=typeof args.query==="string"?args.query.trim().slice(0,80):"";
    const kind=["job","service","product"].includes(args.kind)?args.kind:null;
    const rawCountry=typeof args.country==="string"?args.country.trim().toUpperCase():"";
    const country=/^[A-Z]{2}$/.test(rawCountry)?rawCountry:null;
    const limit=Number.isInteger(args.limit)?Math.max(1,Math.min(30,args.limit)):15;
    const rows=await env.DB.prepare(
      "SELECT l.id,l.kind,l.title,l.description,l.price_minor,l.currency,l.city,l.country,l.created_at,u.name owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.status='active' AND u.status='active' AND u.deletion_requested_at IS NULL AND (? IS NULL OR l.kind=?) AND (? IS NULL OR l.country=?) AND (?='' OR l.title LIKE '%'||?||'%' OR l.description LIKE '%'||?||'%' OR l.city LIKE '%'||?||'%') AND l.owner_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?) AND l.owner_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id=?) ORDER BY l.created_at DESC LIMIT ?"
    ).bind(kind,kind,country,country,q,q,q,q,user.id,user.id,limit).all();
    return {listings:rows.results||[],count:(rows.results||[]).length};
  }
  if (name==="aquipay_get_my_profile") {
    const row=await env.DB.prepare(
      "SELECT u.id,u.name,u.email,p.city,p.bio,p.professions_json,p.skills_json,p.portfolio_json,p.experience_json,p.education_json,p.public_profile,p.updated_at FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=?"
    ).bind(user.id).first();
    return {profile:row||null};
  }
  if (name==="aquipay_get_my_credits") {
    const row=await env.DB.prepare("SELECT available_coins,pending_coins,updated_at FROM wallets WHERE user_id=?").bind(user.id).first();
    return {credits:Number(row?.available_coins||0),pendingCredits:Number(row?.pending_coins||0),updatedAt:row?.updated_at||null,note:"Créditos virtuais do AquiPay; não são dinheiro, não podem ser levantados nem transferidos."};
  }
  if (name==="aquipay_list_my_listings") {
    const limit=Number.isInteger(args.limit)?Math.max(1,Math.min(50,args.limit)):25;
    const rows=await env.DB.prepare("SELECT id,kind,title,description,price_minor,currency,city,country,status,created_at,updated_at FROM listings WHERE owner_id=? ORDER BY created_at DESC LIMIT ?").bind(user.id,limit).all();
    return {listings:rows.results||[]};
  }
  if (name==="aquipay_list_my_proposals") {
    const status=["sent","accepted","rejected","withdrawn","completed","cancelled"].includes(args.status)?args.status:null;
    const limit=Number.isInteger(args.limit)?Math.max(1,Math.min(50,args.limit)):25;
    const rows=await env.DB.prepare(
      "SELECT p.id,p.listing_id,p.sender_id,p.receiver_id,p.message,p.price_minor,p.currency,p.delivery_days,p.status,p.created_at,p.updated_at,l.title listing_title,l.kind listing_kind,CASE WHEN p.sender_id=? THEN 'sent' ELSE 'received' END direction FROM proposals p JOIN listings l ON l.id=p.listing_id WHERE (p.sender_id=? OR p.receiver_id=?) AND (? IS NULL OR p.status=?) ORDER BY p.updated_at DESC LIMIT ?"
    ).bind(user.id,user.id,user.id,status,status,limit).all();
    return {proposals:rows.results||[]};
  }
  if (name==="aquipay_create_listing") {
    if(args.confirm!==true) throw new Error("Publicação não executada. Confirma explicitamente definindo confirm=true.");
    const kind=args.kind,title=typeof args.title==="string"?args.title.trim(): "",description=typeof args.description==="string"?args.description.trim():"";
    const price=args.priceMinor===undefined||args.priceMinor===null?null:args.priceMinor;
    if(!["job","service","product"].includes(kind)||title.length<3||title.length>120||description.length<5||description.length>5000||(price!==null&&(!Number.isSafeInteger(price)||price<0)))throw new Error("Dados do anúncio inválidos.");
    const country=typeof args.country==="string"&&/^[A-Z]{2}$/.test(args.country.toUpperCase())?args.country.toUpperCase():"AO";
    const currency=typeof args.currency==="string"&&/^[A-Z]{3}$/.test(args.currency.toUpperCase())?args.currency.toUpperCase():"AOA";
    const city=typeof args.city==="string"?args.city.trim().slice(0,100):"";
    const plus=await env.DB.prepare("SELECT 1 ok FROM user_subscriptions WHERE user_id=? AND status='active' AND expires_at>? LIMIT 1").bind(user.id,new Date().toISOString()).first();
    const monthParts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Luanda",year:"numeric",month:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    const monthStart=new Date(`${monthParts.year}-${monthParts.month}-01T00:00:00+01:00`).toISOString();
    const id=crypto.randomUUID();
    let inserted;
    if(plus) inserted=await env.DB.prepare("INSERT INTO listings(id,owner_id,kind,title,description,price_minor,currency,city,country) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id").bind(id,user.id,kind,title,description,price,currency,city,country).first();
    else inserted=await env.DB.prepare("INSERT INTO listings(id,owner_id,kind,title,description,price_minor,currency,city,country) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM listings WHERE owner_id=? AND created_at>=?)<10 RETURNING id").bind(id,user.id,kind,title,description,price,currency,city,country,user.id,monthStart).first();
    if(!inserted)throw new Error("Atingiste os 10 anúncios gratuitos deste mês. Ativa o Plus para publicar sem limite.");
    return {ok:true,listingId:id,status:"active",plusActive:!!plus,message:"Anúncio publicado com sucesso."};
  }
  if (name==="aquipay_update_my_listing") {
    if(args.confirm!==true) throw new Error("Edição não executada. Define confirm=true.");
    const id=String(args.listingId||"").trim();
    const old=await env.DB.prepare("SELECT id,title,description,price_minor,currency,city,country FROM listings WHERE id=? AND owner_id=? AND status='active'").bind(id,user.id).first();
    if(!old)throw new Error("Anúncio ativo não encontrado na tua conta.");
    const title=args.title===undefined?old.title:String(args.title).trim();
    const description=args.description===undefined?old.description:String(args.description).trim();
    const price=args.priceMinor===undefined?old.price_minor:args.priceMinor;
    const currency=args.currency===undefined?old.currency:String(args.currency).toUpperCase();
    const city=args.city===undefined?old.city:String(args.city).trim().slice(0,100);
    const country=args.country===undefined?old.country:String(args.country).toUpperCase();
    if(title.length<3||title.length>120||description.length<5||description.length>5000||(price!==null&&(!Number.isSafeInteger(price)||price<0))||!/^[A-Z]{3}$/.test(currency)||!/^[A-Z]{2}$/.test(country))throw new Error("Os dados enviados não são válidos.");
    await env.DB.prepare("UPDATE listings SET title=?,description=?,price_minor=?,currency=?,city=?,country=?,updated_at=? WHERE id=? AND owner_id=? AND status='active'").bind(title,description,price,currency,city,country,new Date().toISOString(),id,user.id).run();
    return {ok:true,listingId:id,message:"Anúncio atualizado."};
  }
  if (name==="aquipay_remove_my_listing") {
    if(args.confirm!==true) throw new Error("Remoção não executada. Define confirm=true.");
    const id=String(args.listingId||"").trim(),item=await env.DB.prepare("SELECT id FROM listings WHERE id=? AND owner_id=? AND status='active'").bind(id,user.id).first();
    if(!item)throw new Error("Anúncio ativo não encontrado na tua conta.");
    const now=new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE listings SET status='removed',updated_at=? WHERE id=? AND owner_id=?").bind(now,id,user.id),
      env.DB.prepare("UPDATE proposals SET status='cancelled',updated_at=? WHERE listing_id=? AND status IN ('sent','accepted')").bind(now,id)
    ]);
    return {ok:true,listingId:id,status:"removed",message:"Anúncio removido; propostas abertas canceladas."};
  }
  if (name==="aquipay_send_proposal") {
    if(args.confirm!==true) throw new Error("Envio não executado. Define confirm=true para confirmar a candidatura.");
    const listingId=String(args.listingId||"").trim(),message=typeof args.message==="string"?args.message.trim():"";
    const price=args.priceMinor===undefined||args.priceMinor===null?null:args.priceMinor;
    if(message.length<10||message.length>4000||(price!==null&&(!Number.isSafeInteger(price)||price<0)))throw new Error("Dados da proposta inválidos.");
    const listing=await env.DB.prepare("SELECT l.id,l.owner_id,l.title,l.currency FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=? AND l.status='active' AND u.status='active' AND u.deletion_requested_at IS NULL").bind(listingId).first();
    if(!listing||listing.owner_id===user.id)throw new Error("Anúncio indisponível para candidatura.");
    if(await env.DB.prepare("SELECT 1 ok FROM proposals WHERE listing_id=? AND status='accepted' LIMIT 1").bind(listingId).first())throw new Error("Este anúncio já está negociado e não aceita novas propostas.");
    if(await env.DB.prepare("SELECT 1 ok FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)").bind(user.id,listing.owner_id,listing.owner_id,user.id).first())throw new Error("Não é possível enviar propostas a este utilizador.");
    const plus=await env.DB.prepare("SELECT 1 ok FROM user_subscriptions WHERE user_id=? AND status='active' AND expires_at>? LIMIT 1").bind(user.id,new Date().toISOString()).first();
    const dateParts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Luanda",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    const dayStart=new Date(`${dateParts.year}-${dateParts.month}-${dateParts.day}T00:00:00+01:00`).toISOString();
    const proposalId=crypto.randomUUID(),conversationId=crypto.randomUUID(),delivery=Number.isInteger(args.deliveryDays)?Math.max(1,Math.min(365,args.deliveryDays)):null;
    let inserted;
    if(plus)inserted=await env.DB.prepare("INSERT INTO proposals(id,listing_id,sender_id,receiver_id,message,price_minor,currency,delivery_days) VALUES(?,?,?,?,?,?,?,?) RETURNING id").bind(proposalId,listingId,user.id,listing.owner_id,message,price,listing.currency||"AOA",delivery).first();
    else inserted=await env.DB.prepare("INSERT INTO proposals(id,listing_id,sender_id,receiver_id,message,price_minor,currency,delivery_days) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM proposals WHERE sender_id=? AND created_at>=?)<5 RETURNING id").bind(proposalId,listingId,user.id,listing.owner_id,message,price,listing.currency||"AOA",delivery,user.id,dayStart).first();
    if(!inserted)throw new Error("Atingiste as 5 candidaturas gratuitas de hoje. Volta amanhã ou ativa o Plus.");
    await env.DB.prepare("INSERT INTO conversations(id,proposal_id,participant_a,participant_b) VALUES(?,?,?,?)").bind(conversationId,proposalId,user.id,listing.owner_id).run();
    await env.DB.prepare("INSERT INTO notifications(id,user_id,kind,title,body,data_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),listing.owner_id,"proposal","Nova proposta","Foi recebida uma nova proposta para «"+listing.title+"».",JSON.stringify({proposalId,conversationId,url:"/?conversation="+encodeURIComponent(conversationId)})).run();
    return {ok:true,proposalId,conversationId,status:"sent",plusActive:!!plus,message:"Proposta enviada com sucesso."};
  }
  if (name==="aquipay_update_proposal_status") {
    if(args.confirm!==true) throw new Error("Alteração não executada. Define confirm=true.");
    const id=String(args.proposalId||"").trim(),status=args.status;
    if(!["accepted","rejected","completed"].includes(status))throw new Error("Estado de proposta inválido.");
    const p=await env.DB.prepare("SELECT p.id,p.listing_id,p.sender_id,p.receiver_id,p.status,c.id conversation_id,l.kind listing_kind,l.owner_id listing_owner_id,l.title listing_title FROM proposals p JOIN listings l ON l.id=p.listing_id LEFT JOIN conversations c ON c.proposal_id=p.id WHERE p.id=?").bind(id).first();
    if(!p)throw new Error("Proposta não encontrada.");
    const receiver=p.receiver_id===user.id,sender=p.sender_id===user.id;
    if(status==="accepted"||status==="rejected"){
      if(!receiver||p.status!=="sent")throw new Error("Só o proprietário do anúncio pode aceitar ou recusar uma proposta pendente.");
    }else{
      const clientId=p.listing_kind==="job"?p.listing_owner_id:p.sender_id;
      if(!(receiver||sender)||user.id!==clientId||p.status!=="accepted")throw new Error("Só o cliente pode confirmar a conclusão de uma proposta aceite.");
    }
    const changed=await env.DB.prepare("UPDATE proposals SET status=?,updated_at=? WHERE id=? AND status=?").bind(status,new Date().toISOString(),id,p.status).run();
    if(!changed.meta?.changes)throw new Error("A proposta já foi alterada. Atualiza a lista e tenta novamente.");
    const recipient=receiver?p.sender_id:p.receiver_id;
    await env.DB.prepare("INSERT INTO notifications(id,user_id,kind,title,body,data_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),recipient,"proposal_status","Atualização da proposta",status==="accepted"?"A tua proposta foi aceite.":status==="rejected"?"A tua proposta foi recusada.":"A proposta foi marcada como concluída.",JSON.stringify({proposalId:id,status,conversationId:p.conversation_id})).run();
    return {ok:true,proposalId:id,status,message:"Estado da proposta atualizado."};
  }
  if (name==="aquipay_list_my_conversations") {
    const rows=await env.DB.prepare(
      "SELECT c.id,c.proposal_id,c.created_at,CASE WHEN c.participant_a=? THEN u2.name ELSE u1.name END other_user_name,(SELECT m.body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message,(SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) unread_count FROM conversations c JOIN users u1 ON u1.id=c.participant_a JOIN users u2 ON u2.id=c.participant_b WHERE (c.participant_a=? OR c.participant_b=?) ORDER BY c.created_at DESC LIMIT 50"
    ).bind(user.id,user.id,user.id,user.id).all();
    return {conversations:rows.results||[]};
  }

  if (name==="aquipay_get_my_stats") {
    const [listings,proposals,conversations,messages,followers,following]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active FROM listings WHERE owner_id=?").bind(user.id).first(),
      env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN sender_id=? THEN 1 ELSE 0 END) sent,SUM(CASE WHEN receiver_id=? THEN 1 ELSE 0 END) received,SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) accepted,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed FROM proposals WHERE sender_id=? OR receiver_id=?").bind(user.id,user.id,user.id,user.id).first(),
      env.DB.prepare("SELECT COUNT(*) total FROM conversations WHERE participant_a=? OR participant_b=?").bind(user.id,user.id).first(),
      env.DB.prepare("SELECT COUNT(*) total FROM messages WHERE sender_id=?").bind(user.id).first(),
      env.DB.prepare("SELECT COUNT(*) total FROM user_follows WHERE followed_id=?").bind(user.id).first(),
      env.DB.prepare("SELECT COUNT(*) total FROM user_follows WHERE follower_id=?").bind(user.id).first()
    ]);
    return {listings:{total:Number(listings?.total||0),active:Number(listings?.active||0)},proposals:{total:Number(proposals?.total||0),sent:Number(proposals?.sent||0),received:Number(proposals?.received||0),accepted:Number(proposals?.accepted||0),completed:Number(proposals?.completed||0)},conversations:Number(conversations?.total||0),messagesSent:Number(messages?.total||0),followers:Number(followers?.total||0),following:Number(following?.total||0)};
  }
  if (name==="aquipay_update_my_profile") {
    if(args.confirm!==true)throw new Error("Atualização não executada. Define confirm=true.");
    const current=await env.DB.prepare("SELECT u.name,p.city,p.bio,p.professions_json,p.skills_json FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=?").bind(user.id).first();
    if(!current)throw new Error("Perfil não encontrado.");
    const name=args.name===undefined?current.name:String(args.name).trim();
    const city=args.city===undefined?current.city:String(args.city).trim().slice(0,100);
    const bio=args.bio===undefined?current.bio:String(args.bio).trim().slice(0,2000);
    const professions=args.professions===undefined?current.professions_json:JSON.stringify(args.professions.map(x=>String(x).trim()).filter(Boolean).slice(0,20));
    const skills=args.skills===undefined?current.skills_json:JSON.stringify(args.skills.map(x=>String(x).trim()).filter(Boolean).slice(0,50));
    if(name.length<2||name.length>80)throw new Error("Nome inválido.");
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET name=? WHERE id=?").bind(name,user.id),
      env.DB.prepare("UPDATE profiles SET city=?,bio=?,professions_json=?,skills_json=?,updated_at=? WHERE user_id=?").bind(city,bio,professions,skills,new Date().toISOString(),user.id)
    ]);
    return {ok:true,message:"Perfil atualizado."};
  }
  if (name==="aquipay_list_my_notifications") {
    const limit=Number.isInteger(args.limit)?Math.max(1,Math.min(50,args.limit)):25;
    const unread=args.unreadOnly===true;
    const rows=await env.DB.prepare("SELECT id,kind,title,body,data_json,read_at,created_at FROM notifications WHERE user_id=? AND (?=0 OR read_at IS NULL) ORDER BY created_at DESC LIMIT ?").bind(user.id,unread?1:0,limit).all();
    return {notifications:rows.results||[],unreadOnly:unread};
  }
  if (name==="aquipay_mark_notifications_read") {
    if(args.confirm!==true)throw new Error("Ação não executada. Define confirm=true.");
    const id=typeof args.notificationId==="string"?args.notificationId.trim():"";
    const now=new Date().toISOString();
    const result=id
      ? await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL").bind(now,id,user.id).run()
      : await env.DB.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").bind(now,user.id).run();
    return {ok:true,marked:Number(result.meta?.changes||0),message:"Notificações atualizadas."};
  }
  if (name==="aquipay_get_conversation_messages") {
    const id=String(args.conversationId||"").trim(),limit=Number.isInteger(args.limit)?Math.max(1,Math.min(100,args.limit)):50;
    const conversation=await env.DB.prepare("SELECT id FROM conversations WHERE id=? AND (participant_a=? OR participant_b=?)").bind(id,user.id,user.id).first();
    if(!conversation)throw new Error("Conversa não encontrada ou sem autorização.");
    const rows=await env.DB.prepare("SELECT m.id,m.sender_id,u.name sender_name,m.body,m.read_at,m.created_at FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.created_at DESC LIMIT ?").bind(id,limit).all();
    return {conversationId:id,messages:(rows.results||[]).reverse()};
  }
  if (name==="aquipay_send_message") {
    if(args.confirm!==true)throw new Error("Mensagem não enviada. Define confirm=true.");
    const id=String(args.conversationId||"").trim(),body=typeof args.message==="string"?args.message.trim():"";
    if(!body||body.length>4000)throw new Error("Mensagem inválida.");
    const c=await env.DB.prepare("SELECT id,participant_a,participant_b FROM conversations WHERE id=? AND (participant_a=? OR participant_b=?)").bind(id,user.id,user.id).first();
    if(!c)throw new Error("Conversa não encontrada ou sem autorização.");
    const recipient=c.participant_a===user.id?c.participant_b:c.participant_a,now=new Date().toISOString(),messageId=crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO messages(id,conversation_id,sender_id,body) VALUES(?,?,?,?)").bind(messageId,id,user.id,body),
      env.DB.prepare("INSERT INTO notifications(id,user_id,kind,title,body,data_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),recipient,"message","Nova mensagem","Recebeste uma nova mensagem no AquiPay.",JSON.stringify({conversationId:id,url:"/?conversation="+encodeURIComponent(id)}))
    ]);
    return {ok:true,messageId,conversationId:id,message:"Mensagem enviada."};
  }
  if (name==="aquipay_get_subscription") {
    const row=await env.DB.prepare("SELECT product_id,status,expires_at,updated_at FROM user_subscriptions WHERE user_id=?").bind(user.id).first();
    const active=!!row&&row.status==="active"&&row.expires_at>new Date().toISOString();
    return {plan:active?"plus":"free",subscription:row||null,active,description:active?"Plano Plus ativo.":"Plano gratuito ativo."};
  }
  throw new Error("Ferramenta não encontrada.");
}

export async function handleAquiPayMcp(request,env) {
  if (request.method==="GET") return new Response("AquiPay MCP endpoint. Use Streamable HTTP POST.",{status:405,headers:{...headers,allow:"POST"}});
  if (request.method!=="POST") return new Response("Method Not Allowed",{status:405,headers:{...headers,allow:"POST"}});
  const contentType=request.headers.get("content-type")||"";
  if (!contentType.toLowerCase().includes("application/json")) return rpcError(null,-32700,"Content-Type deve ser application/json.");
  const raw=await request.text();
  if (raw.length>65536) return rpcError(null,-32600,"Pedido demasiado grande.");
  let message;
  try { message=JSON.parse(raw); } catch { return rpcError(null,-32700,"JSON inválido."); }
  if (!message || message.jsonrpc!=="2.0" || typeof message.method!=="string") return rpcError(message?.id,-32600,"Pedido JSON-RPC inválido.");
  const authenticated=await authenticatedUser(request,env);
  if(!authenticated){
    return new Response(JSON.stringify({jsonrpc:"2.0",id:message.id??null,error:{code:-32001,message:"Autenticação OAuth necessária."}}),{
      status:401,
      headers:{...headers,"www-authenticate":'Bearer resource_metadata="https://api.aquipay.isabstudio.dev/.well-known/oauth-protected-resource/mcp", scope="profile:read profile:write listings:read listings:write proposals:read proposals:write credits:read conversations:read conversations:write notifications:read notifications:write"'}
    });
  }
  if (message.method==="notifications/initialized" || message.method==="notifications/cancelled") return new Response(null,{status:202,headers});
  if (message.method==="ping") return response({jsonrpc:"2.0",id:message.id??null,result:{}});
  if (message.method==="initialize") {
    return response({jsonrpc:"2.0",id:message.id,result:{
      protocolVersion:"2025-06-18",
      capabilities:{tools:{listChanged:false}},
      serverInfo:{name:"aquipay-mcp",version:"1.0.0"},
      instructions:"Conector oficial do AquiPay. As ferramentas de escrita só executam ações da conta autenticada quando confirm=true. Nunca realize compras, gastos de créditos ou operações financeiras; os créditos são virtuais."
    }});
  }
  if (message.method==="tools/list") return response({jsonrpc:"2.0",id:message.id,result:{tools}});
  if (message.method==="tools/call") {
    const user=authenticated;
    if (!message.params || typeof message.params.name!=="string") return rpcError(message.id,-32602,"Ferramenta inválida.");
    const requiredScope={
      aquipay_search_listings:"listings:read",
      aquipay_create_listing:"listings:write",
      aquipay_update_my_listing:"listings:write",
      aquipay_remove_my_listing:"listings:write",
      aquipay_send_proposal:"proposals:write",
      aquipay_update_proposal_status:"proposals:write",
      aquipay_get_my_profile:"profile:read",
      aquipay_get_my_credits:"credits:read",
      aquipay_list_my_listings:"listings:read",
      aquipay_list_my_proposals:"proposals:read",
      aquipay_list_my_conversations:"conversations:read",
      aquipay_get_my_stats:"profile:read",
      aquipay_update_my_profile:"profile:write",
      aquipay_list_my_notifications:"notifications:read",
      aquipay_mark_notifications_read:"notifications:write",
      aquipay_get_conversation_messages:"conversations:read",
      aquipay_send_message:"conversations:write",
      aquipay_get_subscription:"credits:read"
    }[message.params.name];
    if(!requiredScope)return response({jsonrpc:"2.0",id:message.id,result:{...textResult({error:"Ferramenta não encontrada."}),isError:true}});
    if(!user.scopes?.includes(requiredScope))return response({jsonrpc:"2.0",id:message.id,result:{...textResult({error:"Esta ligação não tem permissão para esta operação. Revê as permissões da ligação no AquiPay."}),isError:true}});
    try {
      const result=await callTool(message.params.name,message.params.arguments||{},env,user);
      return response({jsonrpc:"2.0",id:message.id,result:textResult(result)});
    } catch (error) {
      return response({jsonrpc:"2.0",id:message.id,result:{...textResult({error:error.message||"Falha ao executar ferramenta."}),isError:true}});
    }
  }
  return rpcError(message.id,-32601,"Método não suportado.");
}
