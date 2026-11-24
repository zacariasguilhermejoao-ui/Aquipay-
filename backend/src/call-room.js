import { DurableObject } from "cloudflare:workers";

export class CallRoom extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/broadcast" && request.method === "POST") {
      const message = JSON.stringify(await request.json());
      for (const socket of this.ctx.getWebSockets()) {
        if (socket.readyState === WebSocket.OPEN) {
          try { socket.send(message); } catch {}
        }
      }
      return Response.json({ ok: true });
    }
    if (url.pathname !== "/websocket" || request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket necessário", { status: 426 });
    }
    const userId = url.searchParams.get("userId") || "";
    const roomType = url.searchParams.get("roomType") || "";
    if (!userId || !["user", "call"].includes(roomType)) return new Response("Não autorizado", { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, roomType });
    if (roomType === 'call') {
      const latestOffer = await this.ctx.storage.get('latest-offer');
      if (latestOffer && latestOffer.from !== userId) {
        try { server.send(JSON.stringify(latestOffer)); } catch {}
      }
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const state = ws.deserializeAttachment();
    if (!state || state.roomType !== "call" || typeof message !== "string" || message.length > 65536) return;
    let data;
    try { data = JSON.parse(message); } catch { return; }
    if (!["offer", "answer", "candidate", "hangup"].includes(data.type)) return;
    const packet = { type: data.type, payload: data.payload ?? null, from: state.userId };
    if (data.type === 'offer') await this.ctx.storage.put('latest-offer', packet);
    const safe = JSON.stringify(packet);
    for (const peer of this.ctx.getWebSockets()) {
      const other = peer.deserializeAttachment();
      if (peer !== ws && peer.readyState === WebSocket.OPEN && other?.userId !== state.userId) {
        try { peer.send(safe); } catch {}
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch {}
  }

  async webSocketError(ws, error) {
    console.error("Aquipay call websocket", error);
  }
}
