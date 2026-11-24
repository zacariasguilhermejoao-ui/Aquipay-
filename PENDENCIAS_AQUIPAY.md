# AquiPay — Tarefas por fazer

Esta lista reúne os pontos que ainda precisam de configuração, publicação ou teste. Atualizar cada item quando estiver concluído e confirmado.

## Android App Links — abrir o app através do domínio
- [ ] Concluir e validar o workflow de construção Android APK/AAB após as últimas alterações.
- [ ] Obter o SHA-256 do certificado que assina a versão distribuída pela Google Play (Play App Signing, depois de ativado).
- [ ] Criar/publicar `/.well-known/assetlinks.json` em `https://aquipay.isabstudio.dev/.well-known/assetlinks.json`, com package name `com.aquipay.isabstudio` e SHA-256 correto.
- [ ] Confirmar que o Android verifica o domínio como App Link.
- [ ] Testar links para a página inicial e para páginas internas (FAQs, Termos, Privacidade) com o app instalado.
- [ ] Testar o mesmo endereço sem o app instalado e confirmar que abre o site no navegador.

## Google Play Billing — moedas e AquiPay Plus
- [ ] Criar no Play Console os produtos de moedas e a subscrição Plus.
- [ ] Confirmar os IDs reais dos produtos de moedas, Product ID do Plus e Base Plan ID mensal.
- [ ] Confirmar preço e período do Plus (objetivo: 19,99 USD/mês).
- [ ] Ativar Google Play Android Developer API no projeto Google Cloud.
- [ ] Criar conta de serviço e conceder acesso à aplicação no Play Console.
- [ ] Guardar a chave JSON da conta de serviço como secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` no Worker Cloudflare `aquipay-api` (nunca no GitHub).
- [ ] Atualizar/configurar IDs definitivos no Worker e no cliente, caso sejam diferentes dos IDs sugeridos.
- [ ] Enviar AAB para faixa de teste interno e configurar testadores de licença.
- [ ] Testar compras de teste: moedas, compra repetida, cancelamento, Plus, renovação e cancelamento da subscrição.
- [ ] Confirmar que moedas só são creditadas após validação do servidor e que o Plus respeita a expiração.

## Páginas públicas e FAQs
- [ ] Confirmar que a publicação do site no Cloudflare terminou com sucesso.
- [ ] Abrir e testar diretamente todos os endereços públicos: `/perguntas-frequentes`, `/termos-de-uso`, `/politica-de-privacidade`, `/pagamentos-e-reembolsos`, `/regras-da-comunidade`, `/dicas-de-seguranca`, `/cookies-e-armazenamento`, `/ajuda-e-contacto` e `/sobre-o-aquipay`.
- [ ] Confirmar que cada página funciona ao abrir o URL diretamente, atualizar a página e partilhar o link.
- [ ] Confirmar a página de eliminação de conta em `/delete-account.html`.

## Android — entrega e validação
- [ ] Confirmar workflow final do APK/AAB sem erros.
- [ ] Instalar a versão gerada num telefone Android e validar login, sessão, notificações, permissões, splash e navegação.
- [ ] Testar as funcionalidades nativas no dispositivo real antes da publicação.

---
Não marcar tarefas como concluídas apenas porque o código foi alterado; confirmar publicação e teste quando aplicável.
