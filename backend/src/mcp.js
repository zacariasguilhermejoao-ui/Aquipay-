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
    "SELECT u.id,u.name,u.email,u.deletion_requested_at,t.scopes FROM oauth_tokens t JOIN users u ON u.id=t.user_id WHERE t.access_hash=? AND t.access_expires_at>? AND t.refresh_expires_at>? AND t.revoked_at IS NULL AND u.status='active'"
  ).bind(tokenHash,now,now).first();
  if(oauth){
    await env.DB.prepare("UPDATE oauth_tokens SET last_used_at=? WHERE access_hash=? AND revoked_at IS NULL").bind(now,tokenHash).run();
    return {...oauth,scopes:String(oauth.scopes||"").split(/\\s+/).filter(Boolean)};
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
  if (name==="aquipay_list_my_conversations") {
    const rows=await env.DB.prepare(
      "SELECT c.id,c.proposal_id,c.created_at,CASE WHEN c.participant_a=? THEN u2.name ELSE u1.name END other_user_name,(SELECT m.body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message,(SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) unread_count FROM conversations c JOIN users u1 ON u1.id=c.participant_a JOIN users u2 ON u2.id=c.participant_b WHERE (c.participant_a=? OR c.participant_b=?) ORDER BY c.created_at DESC LIMIT 50"
    ).bind(user.id,user.id,user.id,user.id).all();
    return {conversations:rows.results||[]};
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
  if (message.method==="notifications/initialized" || message.method==="notifications/cancelled") return new Response(null,{status:202,headers});
  if (message.method==="ping") return response({jsonrpc:"2.0",id:message.id??null,result:{}});
  if (message.method==="initialize") {
    return response({jsonrpc:"2.0",id:message.id,result:{
      protocolVersion:"2025-06-18",
      capabilities:{tools:{listChanged:false}},
      serverInfo:{name:"aquipay-mcp",version:"1.0.0"},
      instructions:"Conector oficial do AquiPay. As ferramentas só consultam dados da conta autenticada. Não tente executar operações financeiras: créditos são virtuais."
    }});
  }
  if (message.method==="tools/list") return response({jsonrpc:"2.0",id:message.id,result:{tools}});
  if (message.method==="tools/call") {
    const user=await authenticatedUser(request,env);
    if (!user) return rpcError(message.id,-32001,"Autenticação necessária. Envia Authorization: Bearer <token de sessão AquiPay>.");
    if (!message.params || typeof message.params.name!=="string") return rpcError(message.id,-32602,"Ferramenta inválida.");
    const requiredScope={
      aquipay_search_listings:"listings:read",
      aquipay_get_my_profile:"profile:read",
      aquipay_get_my_credits:"credits:read",
      aquipay_list_my_listings:"listings:read",
      aquipay_list_my_proposals:"proposals:read",
      aquipay_list_my_conversations:"conversations:read"
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
